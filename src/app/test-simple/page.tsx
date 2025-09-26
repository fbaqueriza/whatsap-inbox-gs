export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Página de Prueba Simple</h1>
      <p className="mt-4">Si puedes ver esta página, el servidor está funcionando correctamente.</p>
      <div className="mt-4 p-4 bg-green-100 rounded">
        <p className="text-green-800">✅ Servidor funcionando</p>
      </div>
    </div>
  );
}

