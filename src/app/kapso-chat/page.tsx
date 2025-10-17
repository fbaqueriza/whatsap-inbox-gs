import { KapsoChatPanel } from '../../components/KapsoChatPanel';

const KapsoChatPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold p-4 text-center">Kapso Realtime Chat</h1>
      <KapsoChatPanel />
    </div>
  );
};

export default KapsoChatPage;