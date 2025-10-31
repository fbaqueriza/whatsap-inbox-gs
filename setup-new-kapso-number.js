/**
 * Script para configurar un número nuevo de WhatsApp en Kapso
 * Basado en la documentación oficial de Kapso
 */

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

async function setupNewKapsoNumber(userPhoneNumber, userId) {
  try {
    console.log('🔧 [KapsoSetup] Configurando número nuevo para usuario:', userId);
    console.log('📱 [KapsoSetup] Número de WhatsApp:', userPhoneNumber);

    // 1. Crear configuración de WhatsApp en Kapso
    const whatsappConfig = await createWhatsAppConfig(userPhoneNumber);
    console.log('✅ [KapsoSetup] Configuración de WhatsApp creada:', whatsappConfig.id);

    // 2. Configurar webhook
    await setupWebhook(whatsappConfig.id);
    console.log('✅ [KapsoSetup] Webhook configurado');

    // 3. Guardar configuración en la base de datos
    await saveUserWhatsAppConfig(userId, userPhoneNumber, whatsappConfig.id);
    console.log('✅ [KapsoSetup] Configuración guardada en base de datos');

    return {
      success: true,
      whatsappConfigId: whatsappConfig.id,
      phoneNumber: userPhoneNumber
    };

  } catch (error) {
    console.error('❌ [KapsoSetup] Error configurando número:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function createWhatsAppConfig(phoneNumber) {
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      name: `WhatsApp Business - ${phoneNumber}`,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/kapso/supabase-events`,
      webhook_secret: '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb',
      settings: {
        auto_reply: false,
        message_events: true,
        document_events: true,
        media_events: true,
        status_events: true
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Error creando configuración: ${response.statusText}`);
  }

  return await response.json();
}

async function setupWebhook(whatsappConfigId) {
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${whatsappConfigId}/webhook`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/kapso/supabase-events`,
      webhook_secret: '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb',
      events: [
        'message.received',
        'message.sent',
        'message.delivered',
        'message.read',
        'document.received',
        'media.received'
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Error configurando webhook: ${response.statusText}`);
  }

  return await response.json();
}

async function saveUserWhatsAppConfig(userId, phoneNumber, kapsoConfigId) {
  // Esta función debería guardar en Supabase
  // Por ahora, solo logueamos la información
  console.log('💾 [KapsoSetup] Guardando configuración:', {
    userId,
    phoneNumber,
    kapsoConfigId
  });

  // TODO: Implementar guardado en Supabase
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // await supabase.from('user_whatsapp_config').upsert({
  //   user_id: userId,
  //   whatsapp_phone_number: phoneNumber,
  //   kapso_config_id: kapsoConfigId,
  //   is_active: true
  // });
}

// Función para verificar si un usuario ya tiene configuración
async function checkUserWhatsAppConfig(userId) {
  console.log('🔍 [KapsoSetup] Verificando configuración existente para usuario:', userId);
  
  // TODO: Implementar verificación en Supabase
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // const { data, error } = await supabase
  //   .from('user_whatsapp_config')
  //   .select('*')
  //   .eq('user_id', userId)
  //   .single();
  // 
  // if (error && error.code !== 'PGRST116') {
  //   throw error;
  // }
  // 
  // return data;
  
  return null; // Por ahora, siempre retornamos null
}

module.exports = {
  setupNewKapsoNumber,
  checkUserWhatsAppConfig
};

// Ejemplo de uso:
// const { setupNewKapsoNumber } = require('./setup-new-kapso-number');
// 
// setupNewKapsoNumber('+541135562673', 'user-id-here')
//   .then(result => {
//     if (result.success) {
//       console.log('✅ Número configurado exitosamente');
//     } else {
//       console.error('❌ Error:', result.error);
//     }
//   });
