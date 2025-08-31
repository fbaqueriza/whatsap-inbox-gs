import { supabase } from './supabase/client';

// Tipos para el estado de templates
interface TemplateState {
  id: string;
  name: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'DISABLED';
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  components: TemplateComponent[];
  last_updated: Date;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  content?: string;
}

// Clase para manejar el estado de templates
export class TemplateStateService {
  private static instance: TemplateStateService;
  private templateCache: Map<string, TemplateState> = new Map();

  private constructor() {}

  public static getInstance(): TemplateStateService {
    if (!TemplateStateService.instance) {
      TemplateStateService.instance = new TemplateStateService();
    }
    return TemplateStateService.instance;
  }

  /**
   * Actualiza el estado de un template basado en eventos de webhook
   */
  public async updateTemplateStatus(templateId: string, status: string): Promise<void> {
    try {
      console.log(`🔄 Actualizando estado de template ${templateId} a: ${status}`);
      
      const template = await this.getTemplate(templateId);
      if (template) {
        template.status = status as any;
        template.last_updated = new Date();
        
        await this.saveTemplateState(template);
        this.templateCache.set(templateId, template);
        
        console.log(`✅ Estado de template ${templateId} actualizado a: ${status}`);
      } else {
        console.log(`⚠️ Template ${templateId} no encontrado, creando nuevo registro`);
        await this.createTemplateState(templateId, status);
      }

    } catch (error) {
      console.error(`💥 Error actualizando estado de template ${templateId}:`, error);
    }
  }

  /**
   * Actualiza la calidad de un template
   */
  public async updateTemplateQuality(templateId: string, qualityRating: string): Promise<void> {
    try {
      console.log(`⭐ Actualizando calidad de template ${templateId} a: ${qualityRating}`);
      
      const template = await this.getTemplate(templateId);
      if (template) {
        template.quality_rating = qualityRating as any;
        template.last_updated = new Date();
        
        await this.saveTemplateState(template);
        this.templateCache.set(templateId, template);
        
        console.log(`✅ Calidad de template ${templateId} actualizada a: ${qualityRating}`);
      } else {
        console.log(`⚠️ Template ${templateId} no encontrado para actualizar calidad`);
      }

    } catch (error) {
      console.error(`💥 Error actualizando calidad de template ${templateId}:`, error);
    }
  }

  /**
   * Actualiza el estado de un componente de template
   */
  public async updateTemplateComponent(
    templateId: string, 
    componentType: string, 
    status: string
  ): Promise<void> {
    try {
      console.log(`📋 Actualizando componente ${componentType} de template ${templateId} a: ${status}`);
      
      const template = await this.getTemplate(templateId);
      if (template) {
        // Buscar el componente existente o crear uno nuevo
        let component = template.components.find(c => c.type === componentType);
        if (!component) {
          component = { type: componentType as any, status: status as any };
          template.components.push(component);
        } else {
          component.status = status as any;
        }
        
        template.last_updated = new Date();
        
        await this.saveTemplateState(template);
        this.templateCache.set(templateId, template);
        
        console.log(`✅ Componente ${componentType} de template ${templateId} actualizado a: ${status}`);
      } else {
        console.log(`⚠️ Template ${templateId} no encontrado para actualizar componente`);
      }

    } catch (error) {
      console.error(`💥 Error actualizando componente de template ${templateId}:`, error);
    }
  }

  /**
   * Obtiene el estado de un template
   */
  public async getTemplate(templateId: string): Promise<TemplateState | null> {
    try {
      // Verificar cache primero
      if (this.templateCache.has(templateId)) {
        return this.templateCache.get(templateId)!;
      }

      // Buscar en base de datos
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Template no encontrado
          return null;
        }
        throw error;
      }

      if (data) {
        const template: TemplateState = {
          id: data.id,
          name: data.name || templateId,
          status: data.status,
          quality_rating: data.quality_rating,
          components: data.components || [],
          last_updated: new Date(data.last_updated || data.created_at)
        };

        this.templateCache.set(templateId, template);
        return template;
      }

      return null;

    } catch (error) {
      console.error(`💥 Error obteniendo template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene todos los templates
   */
  public async getAllTemplates(): Promise<TemplateState[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        throw error;
      }

      const templates: TemplateState[] = (data || []).map(item => ({
        id: item.id,
        name: item.name || item.id,
        status: item.status,
        quality_rating: item.quality_rating,
        components: item.components || [],
        last_updated: new Date(item.last_updated || item.created_at)
      }));

      // Actualizar cache
      templates.forEach(template => {
        this.templateCache.set(template.id, template);
      });

      return templates;

    } catch (error) {
      console.error('💥 Error obteniendo templates:', error);
      return [];
    }
  }

  /**
   * Guarda el estado de un template en la base de datos
   */
  private async saveTemplateState(template: TemplateState): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .upsert({
          id: template.id,
          name: template.name,
          status: template.status,
          quality_rating: template.quality_rating,
          components: template.components,
          last_updated: template.last_updated.toISOString()
        });

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error(`💥 Error guardando estado de template ${template.id}:`, error);
      throw error;
    }
  }

  /**
   * Crea un nuevo estado de template
   */
  private async createTemplateState(templateId: string, status: string): Promise<void> {
    try {
      const template: TemplateState = {
        id: templateId,
        name: templateId,
        status: status as any,
        components: [],
        last_updated: new Date()
      };

      await this.saveTemplateState(template);
      this.templateCache.set(templateId, template);

      console.log(`✅ Nuevo template ${templateId} creado con estado: ${status}`);

    } catch (error) {
      console.error(`💥 Error creando template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Limpia el cache de templates
   */
  public clearCache(): void {
    this.templateCache.clear();
    console.log('🧹 Cache de templates limpiado');
  }

  /**
   * Obtiene estadísticas de templates
   */
  public async getTemplateStats(): Promise<{
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    disabled: number;
    greenQuality: number;
    yellowQuality: number;
    redQuality: number;
  }> {
    try {
      const templates = await this.getAllTemplates();
      
      const stats = {
        total: templates.length,
        approved: templates.filter(t => t.status === 'APPROVED').length,
        rejected: templates.filter(t => t.status === 'REJECTED').length,
        pending: templates.filter(t => t.status === 'PENDING').length,
        disabled: templates.filter(t => t.status === 'DISABLED').length,
        greenQuality: templates.filter(t => t.quality_rating === 'GREEN').length,
        yellowQuality: templates.filter(t => t.quality_rating === 'YELLOW').length,
        redQuality: templates.filter(t => t.quality_rating === 'RED').length,
      };

      console.log('📊 Estadísticas de templates:', stats);
      return stats;

    } catch (error) {
      console.error('💥 Error obteniendo estadísticas de templates:', error);
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        disabled: 0,
        greenQuality: 0,
        yellowQuality: 0,
        redQuality: 0,
      };
    }
  }
}

// Exportar instancia singleton
export const templateStateService = TemplateStateService.getInstance();
