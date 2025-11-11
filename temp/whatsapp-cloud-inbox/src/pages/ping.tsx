import type { GetServerSideProps } from 'next';

type PingProps = {
  timestamp: string;
};

export const getServerSideProps: GetServerSideProps<PingProps> = async () => {
  return {
    props: {
      timestamp: new Date().toISOString(),
    },
  };
};

export default function PingPage({ timestamp }: PingProps) {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Kapso Inbox · Serverless Ping</h1>
      <p>Este endpoint confirma que existen páginas serverless en el build.</p>
      <p>
        <strong>Timestamp:</strong> {timestamp}
      </p>
    </main>
  );
}


