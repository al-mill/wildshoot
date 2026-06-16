import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  CognitoRefreshToken,
  AuthenticationDetails,
  type CognitoUserSession,
  type ISignUpResult,
} from 'amazon-cognito-identity-js'

export function useCognito() {
  const config = useRuntimeConfig()

  function pool() {
    return new CognitoUserPool({
      UserPoolId: config.public.cognitoUserPoolId,
      ClientId: config.public.cognitoClientId,
    })
  }

  function signIn(
    email: string,
    password: string
  ): Promise<CognitoUserSession> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: pool() })
      user.authenticateUser(
        new AuthenticationDetails({ Username: email, Password: password }),
        {
          onSuccess: resolve,
          onFailure: reject,
          newPasswordRequired: () =>
            reject(new Error('Password change required — contact support')),
        }
      )
    })
  }

  function signUp(
    name: string,
    email: string,
    password: string
  ): Promise<ISignUpResult> {
    return new Promise((resolve, reject) => {
      pool().signUp(
        email,
        password,
        [new CognitoUserAttribute({ Name: 'name', Value: name })],
        [],
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('Sign up failed'))
          resolve(result)
        }
      )
    })
  }

  function confirmSignUp(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: pool() })
      user.confirmRegistration(code, true, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  function globalSignOut(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: pool() })
      user.globalSignOut({ onSuccess: () => resolve(), onFailure: reject })
    })
  }

  function refresh(
    email: string,
    refreshToken: string
  ): Promise<CognitoUserSession> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: email, Pool: pool() })
      user.refreshSession(
        new CognitoRefreshToken({ RefreshToken: refreshToken }),
        (err, session) => {
          if (err) return reject(err)
          resolve(session)
        }
      )
    })
  }

  return { signIn, signUp, confirmSignUp, globalSignOut, refresh }
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
}

export function cognitoErrorMessage(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof err.code === 'string'
  ) {
    return (
      COGNITO_MESSAGES[err.code] ?? 'Something went wrong — please try again'
    )
  }
  return 'Something went wrong — please try again'
}
