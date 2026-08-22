import {
  getAdminSessionErrorMessage,
  getAdminSessionErrorStatus,
  requireAdminSession,
  type SessionData,
} from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';

export async function requireChatbotManagement(): Promise<
  { session: SessionData; error?: never } | { session?: never; error: Response }
> {
  try {
    const session = await requireAdminSession();
    if (!hasAdminPermission(session.role, 'CHAT_MANAGE')) {
      return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { session };
  } catch (error) {
    const status = getAdminSessionErrorStatus(error);
    return {
      error: Response.json(
        { error: getAdminSessionErrorMessage(status) },
        { status },
      ),
    };
  }
}