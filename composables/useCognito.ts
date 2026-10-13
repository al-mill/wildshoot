import { decodeJwtPayload } from '~/utils/session';

export interface CognitoSession {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  payload: Record<string, unknown>;
}

// Login, refresh and logout go through our /api/auth endpoints; sign-up and
// password reset still call Cognito directly.
export function useCognito() {
  const config = useRuntimeConfig();
  const endpoint = `https://cognito-idp.${config.public.awsRegion}.amazonaws.com/`;
  const clientId = config.public.cognitoClientId;
  const apiUrl = String(config.public.apiUrl ?? '').replace(/\/$/, '');

  async function request(target: string, body: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      throw { code: data.__type, message: data.message };
    }
    return data;
  }

  async function authApi(
    path: 'login' | 'refresh' | 'logout',
    body: Record<string, unknown>,
    accessToken?: string
  ) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await fetch(`${apiUrl}/api/auth/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      throw { code: data.code, message: data.message };
    }
    return data;
  }

  async function signUp(name: string, email: string, password: string) {
    await request('SignUp', {
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'name', Value: name }],
    });
  }

  async function confirmSignUp(email: string, code: string) {
    await request('ConfirmSignUp', {
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
    });
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<CognitoSession> {
    const { idToken, accessToken, refreshToken } = await authApi('login', {
      email,
      password,
    });
    return {
      idToken,
      accessToken,
      refreshToken,
      payload: decodeJwtPayload(idToken),
    };
  }

  async function refreshSession(refreshToken: string) {
    const { idToken, accessToken } = await authApi('refresh', {
      refreshToken,
    });
    return { idToken, accessToken };
  }

  async function signOut(accessToken: string) {
    await authApi('logout', {}, accessToken);
  }

  async function forgotPassword(email: string) {
    await request('ForgotPassword', { ClientId: clientId, Username: email });
  }

  async function resetPassword(
    email: string,
    code: string,
    newPassword: string
  ) {
    await request('ConfirmForgotPassword', {
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });
  }

  return {
    signUp,
    confirmSignUp,
    signIn,
    refreshSession,
    signOut,
    forgotPassword,
    resetPassword,
  };
}

const COGNITO_MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'Incorrect email or password',
  UserNotFoundException: 'No account found with that email',
  UserNotConfirmedException: 'Please confirm your email before signing in',
  UsernameExistsException: 'An account with that email already exists',
  CodeMismatchException: 'Invalid confirmation code',
  ExpiredCodeException: 'Confirmation code has expired — request a new one',
  LimitExceededException: 'Too many attempts — please try again later',
  InvalidPasswordException: 'Password does not meet requirements',
};

export function cognitoErrorMessage(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof err.code === 'string'
  ) {
    return (
      COGNITO_MESSAGES[err.code] ?? 'Something went wrong — please try again'
    );
  }
  return 'Something went wrong — please try again';
}
