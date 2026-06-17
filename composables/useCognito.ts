function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export interface CognitoSession {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  payload: Record<string, unknown>;
}

export function useCognito() {
  const config = useRuntimeConfig();
  const endpoint = `https://cognito-idp.${config.public.awsRegion}.amazonaws.com/`;
  const clientId = config.public.cognitoClientId;

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
    const data = await request('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });
    const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
    return {
      idToken: IdToken,
      accessToken: AccessToken,
      refreshToken: RefreshToken,
      payload: decodeJwtPayload(IdToken),
    };
  }

  async function globalSignOut(accessToken: string) {
    await request('GlobalSignOut', { AccessToken: accessToken });
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
    globalSignOut,
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
