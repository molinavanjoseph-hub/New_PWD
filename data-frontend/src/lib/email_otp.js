import { CLOUD_FUNCTIONS_REGION, FIREBASE_PROJECT_ID } from '@/firebase'

const text = (value) => String(value || '').trim()

const buildCallableFallback = (mode) => {
  if (mode === 'send') {
    return 'Unable to send the OTP email right now. Check the deployed Firebase Functions and try again.'
  }

  if (mode === 'resend') {
    return 'Unable to resend the OTP email right now. Check the deployed Firebase Functions and try again.'
  }

  return 'Unable to verify the OTP code right now. Check the deployed Firebase Functions and try the latest OTP again.'
}

const normalizeOtpMessage = ({ code = '', message = '', fallback }) => {
  const normalizedCode = text(code).toLowerCase()
  const normalizedMessage = text(message)

  if (normalizedMessage) return normalizedMessage

  if (normalizedCode === 'invalid-argument') {
    return 'Incorrect or invalid OTP code. Please use the latest 6-digit code sent to your email.'
  }

  if (normalizedCode === 'deadline-exceeded') {
    return 'This OTP code has expired. Please request a new code.'
  }

  if (normalizedCode === 'not-found') {
    return 'No OTP request was found for this email. Please request a new code.'
  }

  if (normalizedCode === 'permission-denied') {
    return 'Too many incorrect OTP attempts were made. Please request a new code.'
  }

  if (normalizedCode === 'resource-exhausted') {
    return 'Too many OTP requests were made for this email. Please wait a bit before trying again.'
  }

  if (normalizedCode === 'already-exists') {
    return 'This email address has already been verified.'
  }

  if (normalizedCode === 'failed-precondition') {
    return 'OTP email delivery is not configured yet. Check the deployed SendGrid environment variables.'
  }

  if (normalizedCode === 'unavailable') {
    return 'Cloud Functions is unavailable right now. Check if your Firebase Functions are deployed and running.'
  }

  return fallback
}

const buildHttpFunctionUrl = (functionName) =>
  `https://${CLOUD_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/${functionName}`

const parseOtpHttpResponse = async (response, fallback) => {
  const body = await response.json().catch(() => null)

  if (response.ok) {
    return body || {}
  }

  const errorCode = text(body?.error?.status || body?.status)
  const errorMessage = text(body?.error?.message || body?.message)

  throw new Error(
    normalizeOtpMessage({
      code: errorCode,
      message: errorMessage,
      fallback,
    }),
  )
}

const postOtpRequest = async (functionName, payload, fallback) => {
  const response = await fetch(buildHttpFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    throw new Error(fallback)
  })

  return parseOtpHttpResponse(response, fallback)
}

export const sendEmployerRegistrationOtp = async (payload) =>
  postOtpRequest('sendEmployerRegistrationOtpHttp', payload, buildCallableFallback('send'))

export const resendEmployerRegistrationOtp = async (payload) =>
  postOtpRequest('resendEmployerRegistrationOtpHttp', payload, buildCallableFallback('resend'))

export const verifyEmployerRegistrationOtp = async (payload) =>
  postOtpRequest('verifyEmployerRegistrationOtpHttp', payload, buildCallableFallback('verify'))

export const sendRegistrationOtp = sendEmployerRegistrationOtp

export const resendRegistrationOtp = resendEmployerRegistrationOtp

export const verifyRegistrationOtp = verifyEmployerRegistrationOtp
