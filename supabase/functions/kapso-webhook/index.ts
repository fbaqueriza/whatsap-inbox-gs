import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔔 [Kapso Function] Webhook recibido')

    // Parse the request body
    const body = await req.json()
    console.log('🔔 [Kapso Function] Datos recibidos:', JSON.stringify(body, null, 2))

    // Process WhatsApp messages
    if (body.type === 'whatsapp.message.received' && body.data) {
      for (const item of body.data) {
        const message = item.message
        const conversation = item.conversation

        console.log('🔔 [Kapso Function] Procesando mensaje:', {
          id: message.id,
          content: message.content,
          direction: message.direction,
          phone_number: message.phone_number,
          conversation_id: conversation.id
        })

        // Insert message into Supabase using existing whatsapp_messages table
        const { error } = await supabase
          .from('whatsapp_messages')
          .insert({
            id: message.id,
            content: message.content,
            direction: message.direction,
            phone_number: message.phone_number,
            conversation_id: conversation.id,
            status: message.status,
            created_at: message.created_at,
            raw_data: message
          })

        if (error) {
          console.error('❌ [Kapso Function] Error insertando mensaje:', error)
        } else {
          console.log('✅ [Kapso Function] Mensaje insertado correctamente')
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook procesado correctamente' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ [Kapso Function] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Error procesando webhook' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
