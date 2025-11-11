import { NextResponse } from 'next/server';
import { buildTemplateSendPayload } from '@kapso/whatsapp-cloud-api';
import type { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { tryGetWhatsAppClient } from '@/lib/whatsapp-client';
import type { TemplateParameterInfo } from '@/types/whatsapp';

type TemplateSendInput = Parameters<typeof buildTemplateSendPayload>[0];
type TemplateMessageInput = Parameters<WhatsAppClient['messages']['sendTemplate']>[0];
type TemplatePayload = TemplateMessageInput['template'];
type TemplateBodyParameter = NonNullable<TemplateSendInput['body']>[number];
type TemplateHeaderParameter = Extract<NonNullable<TemplateSendInput['header']>, { type: 'text' }>;
type TemplateButtonParameter = Extract<NonNullable<TemplateSendInput['buttons']>[number], { subType: 'url' }>;
type TemplateButtonParameterValue = NonNullable<TemplateButtonParameter['parameters']>[number];

function sanitizeString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      to,
      templateName,
      languageCode,
      parameters,
      parameterInfo,
      phoneNumberId,
      userId,
      appUrl: appUrlRaw,
    } = body as Record<string, unknown> as {
      to?: string;
      templateName?: string;
      languageCode?: string;
      parameters?: unknown;
      parameterInfo?: TemplateParameterInfo;
      phoneNumberId?: string;
      userId?: string;
      appUrl?: string;
    };

    if (!to || !templateName || !languageCode) {
      return NextResponse.json(
        { error: 'Missing required fields: to, templateName, languageCode' },
        { status: 400 }
      );
    }

    const appUrl = sanitizeString(
      appUrlRaw ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        null
    );
    const authHeader = sanitizeString(request.headers.get('authorization'));
    let resolvedPhoneNumberId = sanitizeString(
      typeof phoneNumberId === 'string' ? phoneNumberId : process.env.PHONE_NUMBER_ID ?? null
    );

    if (!resolvedPhoneNumberId && authHeader && userId && appUrl) {
      try {
        const response = await fetch(
          `${appUrl.replace(/\/$/, '')}/api/whatsapp/configs`,
          {
            method: 'GET',
            headers: { Authorization: authHeader },
            cache: 'no-store',
          }
        );

        if (response.ok) {
          const configPayload = (await response.json()) as Record<string, unknown>;
          const rawConfigs =
            Array.isArray((configPayload as any)?.configs)
              ? (configPayload as any).configs
              : Array.isArray((configPayload as any)?.data)
              ? (configPayload as any).data
              : [];
          const configs: any[] = Array.isArray(rawConfigs) ? rawConfigs : [];

          const activeConfig =
            configs.find((config: any) => config?.is_active) ??
            configs.find((config: any) => config?.isActive) ??
            configs[0];

          if (activeConfig) {
            resolvedPhoneNumberId =
              activeConfig?.phone_number_id ??
              activeConfig?.meta_phone_number_id ??
              activeConfig?.meta_phone_id ??
              null;
          }
        } else {
          console.warn(
            '⚠️ [TemplatesSend] No se pudo obtener phone_number_id desde appUrl:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('❌ [TemplatesSend] Error consultando appUrl para phone_number_id:', error);
      }
    }

    if (!resolvedPhoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required field: phoneNumberId' },
        { status: 400 }
      );
    }

    const templateOptions: TemplateSendInput = {
      name: templateName,
      language: languageCode
    };

    if (parameters && parameterInfo) {
      const typedParamInfo = parameterInfo as TemplateParameterInfo;

      const bodyParameters: TemplateBodyParameter[] = [];
      const buttonParameters: TemplateButtonParameter[] = [];
      let headerParameter: TemplateHeaderParameter | undefined;

      const getParameterValue = (paramName: string, index: number) => {
        if (Array.isArray(parameters)) {
          return parameters[index];
        }
        const recordParameters = parameters as Record<string, unknown>;
        return recordParameters ? recordParameters[paramName] : undefined;
      };

      typedParamInfo.parameters.forEach((paramDef, index) => {
        const rawValue = getParameterValue(paramDef.name, index);
        if (rawValue === undefined || rawValue === null) {
          return;
        }

        const textValue = String(rawValue);
        if (!textValue.trim()) {
          return;
        }

        if (paramDef.component === 'HEADER') {
          if (!headerParameter) {
            headerParameter = {
              type: 'text',
              text: textValue,
            } as TemplateHeaderParameter;
          }
          return;
        }

        if (paramDef.component === 'BODY') {
          bodyParameters.push({
            type: 'text',
            text: textValue,
          } as TemplateBodyParameter);
          return;
        }

        if (paramDef.component === 'BUTTON' && typeof paramDef.buttonIndex === 'number') {
          let button = buttonParameters.find((btn) => btn.index === paramDef.buttonIndex);
          if (!button) {
            button = {
              type: 'button',
              subType: 'url',
              index: paramDef.buttonIndex,
              parameters: []
            } as TemplateButtonParameter;
            buttonParameters.push(button);
          }

          const buttonParameter: TemplateButtonParameterValue = {
            type: 'text',
            text: textValue,
          };

          if (!button.parameters) {
            button.parameters = [];
          }

          button.parameters.push(buttonParameter);
        }
      });

      if (headerParameter) {
        templateOptions.header = headerParameter;
      }

      if (bodyParameters.length > 0) {
        templateOptions.body = bodyParameters;
      }

      if (buttonParameters.length > 0) {
        templateOptions.buttons = buttonParameters;
      }
    }

    const whatsappClient = tryGetWhatsAppClient();

    if (!whatsappClient) {
      return NextResponse.json(
        {
          error: 'WhatsAppClient no disponible',
          detail: 'No se encontró KAPSO_API_KEY en el entorno del inbox desplegado'
        },
        { status: 400 }
      );
    }

    const templatePayload = buildTemplateSendPayload(templateOptions) as TemplatePayload;

    // Send template message
    const result = await whatsappClient.messages.sendTemplate({
      phoneNumberId: resolvedPhoneNumberId,
      to,
      template: templatePayload
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending template:', error);
    return NextResponse.json(
      { error: 'Failed to send template message' },
      { status: 500 }
    );
  }
}
