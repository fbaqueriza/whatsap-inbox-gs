#!/bin/bash

# Script para desplegar la Edge Function de Kapso

echo "🚀 Desplegando Edge Function de Kapso..."

# Verificar que Supabase CLI esté instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no está instalado. Instálalo con:"
    echo "npm install -g supabase"
    exit 1
fi

# Verificar que estemos en el directorio correcto
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ No se encontró supabase/config.toml. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

# Desplegar la función
echo "📦 Desplegando función kapso-webhook..."
supabase functions deploy kapso-webhook

if [ $? -eq 0 ]; then
    echo "✅ Función desplegada correctamente"
    echo ""
    echo "🔗 URL de la función:"
    echo "https://jyalmdhyuftjldewbfzw.supabase.co/functions/v1/kapso-webhook"
    echo ""
    echo "📝 Configura esta URL en Kapso como webhook:"
    echo "URL: https://jyalmdhyuftjldewbfzw.supabase.co/functions/v1/kapso-webhook"
    echo "Método: POST"
    echo "Secreto: 2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb"
else
    echo "❌ Error desplegando la función"
    exit 1
fi
