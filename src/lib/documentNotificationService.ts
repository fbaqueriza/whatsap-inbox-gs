/**
 * SERVICIO DE NOTIFICACIONES PARA DOCUMENTOS
 * Maneja notificaciones push y en tiempo real para el sistema de documentos
 * Fecha: 17/09/2025
 */

import { createClient } from '@supabase/supabase-js';
import { 
  DocumentNotification, 
  NotificationType, 
  DocumentType 
} from '../types/documents';

export class DocumentNotificationService {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * 📢 CREAR NOTIFICACIÓN DE DOCUMENTO
   */
  async createNotification(
    userId: string,
    documentId: string,
    notificationType: NotificationType,
    title: string,
    message: string
  ): Promise<{ success: boolean; notification_id?: string; error?: string }> {
    try {
      console.log('📢 [DocumentNotificationService] Creando notificación:', notificationType);
      
      const { data, error } = await this.supabase
        .from('document_notifications')
        .insert([{
          document_id: documentId,
          user_id: userId,
          notification_type: notificationType,
          title,
          message,
          read: false,
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (error) {
        console.error('❌ [DocumentNotificationService] Error creando notificación:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [DocumentNotificationService] Notificación creada:', data.id);
      return { success: true, notification_id: data.id };

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error inesperado:', error);
      return { success: false, error: 'Error inesperado creando notificación' };
    }
  }

  /**
   * 📱 ENVIAR NOTIFICACIÓN PUSH
   */
  async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 [DocumentNotificationService] Enviando notificación push a:', userId);
      
      // Obtener tokens de dispositivos del usuario
      const { data: devices, error: devicesError } = await this.supabase
        .from('user_devices')
        .select('push_token')
        .eq('user_id', userId)
        .eq('active', true);

      if (devicesError || !devices || devices.length === 0) {
        console.log('ℹ️ [DocumentNotificationService] No hay dispositivos registrados');
        return { success: true }; // No es un error, simplemente no hay dispositivos
      }

      // Enviar notificación a cada dispositivo
      const pushPromises = devices.map(device => 
        this.sendToDevice(device.push_token, title, message, data)
      );

      const results = await Promise.allSettled(pushPromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`📱 [DocumentNotificationService] Enviadas: ${successful}, Fallidas: ${failed}`);
      
      return { success: successful > 0 };

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error enviando push:', error);
      return { success: false, error: 'Error enviando notificación push' };
    }
  }

  /**
   * 📄 NOTIFICACIONES ESPECÍFICAS POR TIPO DE DOCUMENTO
   */
  async notifyDocumentReceived(
    userId: string,
    documentId: string,
    filename: string,
    senderType: 'provider' | 'user'
  ): Promise<void> {
    const senderText = senderType === 'provider' ? 'proveedor' : 'usuario';
    const title = `📄 Nuevo documento recibido`;
    const message = `Se recibió el documento "${filename}" del ${senderText}`;

    await this.createNotification(userId, documentId, 'document_received', title, message);
    await this.sendPushNotification(userId, title, message, { document_id: documentId });
  }

  async notifyDocumentProcessed(
    userId: string,
    documentId: string,
    filename: string,
    documentType: DocumentType,
    confidenceScore?: number
  ): Promise<void> {
    const confidenceText = confidenceScore ? ` (${Math.round(confidenceScore * 100)}% confianza)` : '';
    const title = `✅ Documento procesado`;
    const message = `El ${documentType} "${filename}" fue procesado exitosamente${confidenceText}`;

    await this.createNotification(userId, documentId, 'document_processed', title, message);
    await this.sendPushNotification(userId, title, message, { document_id: documentId });
  }

  async notifyDocumentAssigned(
    userId: string,
    documentId: string,
    filename: string,
    orderNumber?: string,
    providerName?: string
  ): Promise<void> {
    const assignmentText = orderNumber ? 
      `asignado a la orden ${orderNumber}` : 
      `asignado al proveedor ${providerName}`;
    
    const title = `🔗 Documento asignado`;
    const message = `El documento "${filename}" fue ${assignmentText}`;

    await this.createNotification(userId, documentId, 'document_assigned', title, message);
    await this.sendPushNotification(userId, title, message, { document_id: documentId });
  }

  async notifyProcessingError(
    userId: string,
    documentId: string,
    filename: string,
    error: string
  ): Promise<void> {
    const title = `❌ Error procesando documento`;
    const message = `Error procesando "${filename}": ${error}`;

    await this.createNotification(userId, documentId, 'processing_error', title, message);
    await this.sendPushNotification(userId, title, message, { document_id: documentId });
  }

  /**
   * 📋 OBTENER NOTIFICACIONES DEL USUARIO
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50
  ): Promise<DocumentNotification[]> {
    try {
      const { data, error } = await this.supabase
        .from('document_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [DocumentNotificationService] Error obteniendo notificaciones:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error inesperado:', error);
      return [];
    }
  }

  /**
   * 👁️ MARCAR NOTIFICACIÓN COMO LEÍDA
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('document_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('❌ [DocumentNotificationService] Error marcando como leída:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error inesperado:', error);
      return { success: false, error: 'Error inesperado' };
    }
  }

  /**
   * 📊 OBTENER CONTADOR DE NOTIFICACIONES NO LEÍDAS
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('document_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('❌ [DocumentNotificationService] Error obteniendo contador:', error);
        return 0;
      }

      return count || 0;

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error inesperado:', error);
      return 0;
    }
  }

  /**
   * 🗑️ LIMPIAR NOTIFICACIONES ANTIGUAS
   */
  async cleanOldNotifications(daysOld: number = 30): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const { count, error } = await this.supabase
        .from('document_notifications')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('❌ [DocumentNotificationService] Error limpiando notificaciones:', error);
        return { success: false, deleted: 0, error: error.message };
      }

      console.log(`🗑️ [DocumentNotificationService] Limpiadas ${count} notificaciones antiguas`);
      return { success: true, deleted: count || 0 };

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error inesperado:', error);
      return { success: false, deleted: 0, error: 'Error inesperado' };
    }
  }

  /**
   * 🔧 MÉTODOS AUXILIARES
   */
  private async sendToDevice(
    pushToken: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      // Implementación simple de notificación push (sin servicio externo por ahora)
      console.log(`📱 [DocumentNotificationService] Enviando notificación push a dispositivo:`, pushToken);
      console.log(`📱 [DocumentNotificationService] Título: ${title}`);
      console.log(`📱 [DocumentNotificationService] Mensaje: ${message}`);
      console.log(`📱 [DocumentNotificationService] Datos:`, data);
      
      // TODO: Implementar servicio de notificaciones push real
      // Por ahora solo logueamos la notificación

    } catch (error) {
      console.error('❌ [DocumentNotificationService] Error enviando a dispositivo:', error);
      throw error;
    }
  }
}
