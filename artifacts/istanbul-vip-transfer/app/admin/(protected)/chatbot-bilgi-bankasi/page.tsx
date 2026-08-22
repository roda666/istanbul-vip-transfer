import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import ChatbotKnowledgeClient from './_ChatbotKnowledgeClient';

export const metadata: Metadata = {
  title: 'Chatbot Bilgi Bankası | Admin',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function ChatbotKnowledgePage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Chatbot Bilgi Bankası"
        description="Ziyaretçi asistanının sorulara doğru yanıt verebilmesi için gerekli bilgi kayıtlarını yönetin"
      />
      <ChatbotKnowledgeClient />
    </div>
  );
}
