export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore();
  if (!auth.isLoggedIn) return navigateTo('/login');
  if (!auth.isAdmin) return navigateTo('/');
});
