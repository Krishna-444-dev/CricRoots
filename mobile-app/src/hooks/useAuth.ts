// Re-exports the context-backed useAuth so every consumer shares one auth state instance.
// See src/contexts/AuthContext.tsx for why this needs to be context-backed rather than a bare
// hook factory call per component.
export { useAuth } from '../contexts/AuthContext';
