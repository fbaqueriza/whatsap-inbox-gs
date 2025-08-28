// Script para forzar recarga completa y limpiar cache
console.log('🔄 Forzando recarga completa...');

// Limpiar cache del navegador
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
    console.log('✅ Cache limpiado');
  });
}

// Forzar recarga completa
window.location.reload(true);

// Si no funciona, mostrar instrucciones
setTimeout(() => {
  console.log('📋 Instrucciones manuales:');
  console.log('1. Presiona Ctrl+Shift+Delete');
  console.log('2. Selecciona "Todo el tiempo"');
  console.log('3. Marca "Archivos en caché"');
  console.log('4. Click en "Limpiar datos"');
  console.log('5. Recarga la página con Ctrl+Shift+R');
}, 2000);
