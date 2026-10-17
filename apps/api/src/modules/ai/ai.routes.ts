import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { aiRateLimiter } from '../../middleware/rateLimit';
import {
  aiController,
  chatSchema,
  executeSchema,
  saveConversationSchema,
  createConversationSchema,
  renameConversationSchema,
} from './ai.controller';

const router: Router = Router();

router.use(authenticate);
router.use(requireModule('aiAssistant'));
router.use(requireBranch);

// The assistant only ever exposes the data tools a user is already permitted
// for (see ai.tools.buildToolsForUser), so per-tool RBAC is the real data gate.
// The route itself just needs an authenticated, branch-scoped session.
router.post('/chat/stream', aiRateLimiter, validateBody(chatSchema), (req, res) =>
  aiController.chatStream(req, res)
);

// Execute a write action the user confirmed in the chat UI. Permission + args
// are re-checked in the service — the proposed action from the model is a hint,
// not an authorization.
router.post('/chat/execute', aiRateLimiter, validateBody(executeSchema), (req, res, next) =>
  aiController.executeAction(req, res, next)
);

// Conversation history — per-user, scoped to tenant. Plain JSON CRUD (no rate
// limiter; these are cheap and called as the user chats).
router.get('/conversations', (req, res, next) => aiController.listConversations(req, res, next));
router.post('/conversations', validateBody(createConversationSchema), (req, res, next) =>
  aiController.createConversation(req, res, next)
);
router.get('/conversations/:id', (req, res, next) => aiController.getConversation(req, res, next));
router.put('/conversations/:id', validateBody(saveConversationSchema), (req, res, next) =>
  aiController.saveConversation(req, res, next)
);
router.patch('/conversations/:id', validateBody(renameConversationSchema), (req, res, next) =>
  aiController.renameConversation(req, res, next)
);
router.delete('/conversations/:id', (req, res, next) =>
  aiController.deleteConversation(req, res, next)
);

export default router;
