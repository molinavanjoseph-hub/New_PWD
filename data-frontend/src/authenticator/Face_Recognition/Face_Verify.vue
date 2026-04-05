<script setup>
import * as blazeface from '@tensorflow-models/blazeface'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import * as tf from '@tensorflow/tfjs'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  hasSelfie: {
    type: Boolean,
    default: false,
  },
  isComplete: {
    type: Boolean,
    default: false,
  },
  standalone: {
    type: Boolean,
    default: false,
  },
  headerEyebrow: {
    type: String,
    default: 'FACE CHECK',
  },
  headerTitle: {
    type: String,
    default: 'Face Verification',
  },
  headerDescription: {
    type: String,
    default: 'Only a real, clear, live face inside the guide can continue to Step 2.',
  },
  autoStart: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['selfie-selected', 'status-change', 'complete'])

const verificationMode = ref('guide')
const selectedCameraMode = ref('user')
const cameraError = ref('')
const stream = ref(null)
const isCameraReady = ref(false)
const isCameraStarting = ref(false)
const isFaceDetected = ref(false)
const isFaceScanning = ref(false)
const isAutoSubmitting = ref(false)
const isScanSuccessful = ref(false)
const detectionPhase = ref('idle')
const isDetectorFallbackMode = ref(false)
const viewerRef = ref(null)
const videoRef = ref(null)
const canvasRef = ref(null)
const guideFrameBox = ref({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  opacity: 0,
})
let detectionTimerId
let successTimerId
let detectionLoopId
let isDetectionRunning = false
let faceDetector = null
let fallbackFaceDetector = null
let landmarkDetector = null
let objectDetector = null
let baselineFaceCenterX = null
let baselineFaceCenterY = null
let baselineFaceWidth = null
let baselineFaceHeight = null
let steadyFrameCount = 0
const livenessStage = ref('blink')
const blinkStage = ref('waiting_open')
let blinkChallengeStartedAt = 0
let blinkFailureUntil = 0
let phoneDetectedUntil = 0
let lastPhoneCheckAt = 0

const MIN_FACE_SHARPNESS = 10
const MIN_FACE_BRIGHTNESS = 20
const MIN_IRIS_CENTER_RATIO = 0.3
const MAX_IRIS_CENTER_RATIO = 0.7
const MAX_EYE_LINE_TILT_RATIO = 0.08
const MAX_NOSE_OFFSET_RATIO = 0.16
const MIN_EYE_OPEN_RATIO = 0.24
const MAX_EYE_BLINK_RATIO = 0.17
const MIN_EYE_REOPEN_RATIO = 0.22
const BLINK_TIMEOUT_MS = 4000
const BLINK_FAIL_DISPLAY_MS = 1600
const PHONE_DETECTED_DISPLAY_MS = 1800
const PHONE_CHECK_INTERVAL_MS = 700

const resetTrackingState = () => {
  isFaceDetected.value = false
  isFaceScanning.value = false
  baselineFaceCenterX = null
  baselineFaceCenterY = null
  baselineFaceWidth = null
  baselineFaceHeight = null
  steadyFrameCount = 0
}

const resetLivenessState = () => {
  livenessStage.value = 'blink'
  blinkStage.value = 'waiting_open'
  blinkChallengeStartedAt = 0
  blinkFailureUntil = 0
  phoneDetectedUntil = 0
  lastPhoneCheckAt = 0
}

const resetGuideFrameBox = () => {
  guideFrameBox.value = {
    left: guideFrameBox.value.left,
    top: guideFrameBox.value.top,
    width: guideFrameBox.value.width,
    height: guideFrameBox.value.height,
    opacity: 0,
  }
}

const getPointsBounds = (points = []) => {
  if (!points.length) return null

  return points.reduce(
    (accumulator, point) => ({
      minX: Math.min(accumulator.minX, point.x),
      maxX: Math.max(accumulator.maxX, point.x),
      minY: Math.min(accumulator.minY, point.y),
      maxY: Math.max(accumulator.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  )
}

const updateGuideFrameBox = (box, frameWidth, frameHeight, keypoints = []) => {
  const viewer = viewerRef.value
  if (!viewer || !frameWidth || !frameHeight) return

  const viewerWidth = viewer.clientWidth
  const viewerHeight = viewer.clientHeight
  if (!viewerWidth || !viewerHeight) return

  const scale = Math.max(viewerWidth / frameWidth, viewerHeight / frameHeight)
  const renderedWidth = frameWidth * scale
  const renderedHeight = frameHeight * scale
  const offsetX = (viewerWidth - renderedWidth) / 2
  const offsetY = (viewerHeight - renderedHeight) / 2

  const contourPoints = keypoints.length ? scalePolylinePoints(getPolylinePoints(keypoints, FACE_OUTER_CONTOUR), 1.03, 1.02) : []
  const contourBounds = getPointsBounds(contourPoints)

  const sourceMinX = contourBounds ? contourBounds.minX : box.x - box.width * 0.06
  const sourceMaxX = contourBounds ? contourBounds.maxX : box.x + box.width * 1.06
  const sourceMinY = contourBounds ? contourBounds.minY : box.y - box.height * 0.08
  const sourceMaxY = contourBounds ? contourBounds.maxY : box.y + box.height * 1.08

  const expandedWidth = sourceMaxX - sourceMinX
  const expandedHeight = sourceMaxY - sourceMinY

  const mappedLeft = offsetX + sourceMinX * scale
  const mappedTop = offsetY + sourceMinY * scale
  const mappedWidth = expandedWidth * scale
  const mappedHeight = expandedHeight * scale

  const next = {
    left: Math.max(-renderedWidth * 0.15, Math.min(viewerWidth - mappedWidth + renderedWidth * 0.15, mappedLeft)),
    top: Math.max(-renderedHeight * 0.12, Math.min(viewerHeight - mappedHeight + renderedHeight * 0.12, mappedTop)),
    width: Math.min(viewerWidth * 0.64, Math.max(120, mappedWidth)),
    height: Math.min(viewerHeight * 0.72, Math.max(156, mappedHeight)),
    opacity: 1,
  }

  guideFrameBox.value = {
    left: guideFrameBox.value.left + (next.left - guideFrameBox.value.left) * 0.6,
    top: guideFrameBox.value.top + (next.top - guideFrameBox.value.top) * 0.6,
    width: guideFrameBox.value.width + (next.width - guideFrameBox.value.width) * 0.52,
    height: guideFrameBox.value.height + (next.height - guideFrameBox.value.height) * 0.52,
    opacity: guideFrameBox.value.opacity + (next.opacity - guideFrameBox.value.opacity) * 0.7,
  }
}

const scanFrameStyle = computed(() => ({
  left: `${guideFrameBox.value.left}px`,
  top: `${guideFrameBox.value.top}px`,
  width: `${guideFrameBox.value.width}px`,
  height: `${guideFrameBox.value.height}px`,
  opacity: guideFrameBox.value.opacity,
}))

const statusMessage = computed(() => {
  if (props.hasSelfie) return 'Face verified. Redirecting to Step 2.'
  if (isScanSuccessful.value) return 'Verification successful. Preparing Step 2...'
  if (isAutoSubmitting.value) return 'Face detected. Saving your verified face scan...'
  if (isCameraStarting.value) return 'Starting your device camera. Please wait...'
  if (cameraError.value) return cameraError.value

  switch (detectionPhase.value) {
    case 'face_missing':
      return 'Face not detected. Move closer to the camera and keep your full face inside the guide.'
    case 'off_center':
      return 'Center your face inside the guide and keep your whole face visible.'
    case 'multiple_faces':
      return 'Only one face is allowed in the camera. Remove other faces from view.'
    case 'too_small':
      return 'Your face is too far from the camera. Move closer until it fills more of the guide.'
    case 'too_large':
      return 'Move a little farther so your face fits inside the guide.'
    case 'too_blurry':
      return 'Face is too blurry. Hold still and improve camera focus.'
    case 'look_straight':
      return 'Keep your face centered and both eyes clearly visible.'
    case 'blink_once':
      return 'Blink once to prove you are a live person.'
    case 'blink_failed':
      return 'Blink challenge failed. Please blink once and try again.'
    case 'phone_detected':
      return 'Phone or screen detected. Using a phone image is not allowed for face verification.'
    case 'verifying':
      return 'Face detected. Hold still while we capture your selfie.'
    case 'unsupported':
      return 'Automatic face detection is unavailable right now. Restart the camera and try again.'
    case 'ready':
    case 'align':
    default:
      return 'Align your face inside the frame, keep steady, and look straight at the camera.'
  }
})

const overlayMessageClass = computed(() => ({
  'is-warning': ['face_missing', 'off_center', 'multiple_faces', 'too_small', 'too_large', 'too_blurry', 'look_straight', 'unsupported', 'blink_failed', 'phone_detected'].includes(
    detectionPhase.value,
  ),
  'is-success': isScanSuccessful.value,
}))

const inlineErrorMessage = computed(() => {
  if (!cameraError.value) return ''
  if (cameraError.value === statusMessage.value) return ''
  return cameraError.value
})

const syncVideoStream = async () => {
  await nextTick()
  if (videoRef.value && stream.value) {
    videoRef.value.srcObject = stream.value
    await videoRef.value.play().catch(() => {})
  }
}

const clearDetectionTimer = () => {
  if (detectionTimerId) {
    window.clearTimeout(detectionTimerId)
    detectionTimerId = null
  }
}

const clearSuccessTimer = () => {
  if (successTimerId) {
    window.clearTimeout(successTimerId)
    successTimerId = null
  }
}

const clearDetectionLoop = () => {
  if (detectionLoopId) {
    window.clearInterval(detectionLoopId)
    detectionLoopId = null
  }
}

const resetDetectionProgress = () => {
  resetTrackingState()
  isAutoSubmitting.value = false
  isScanSuccessful.value = false
  detectionPhase.value = 'idle'
  isDetectorFallbackMode.value = false
}

const computeFaceMetrics = (context, faceBox, frameWidth, frameHeight) => {
  const x = Math.max(0, Math.floor(faceBox.x))
  const y = Math.max(0, Math.floor(faceBox.y))
  const width = Math.min(frameWidth - x, Math.floor(faceBox.width))
  const height = Math.min(frameHeight - y, Math.floor(faceBox.height))

  if (width <= 0 || height <= 0) return null

  const imageData = context.getImageData(x, y, width, height).data
  let brightnessTotal = 0
  let edgeTotal = 0
  let samples = 0
  const stride = 4
  const step = Math.max(2, Math.floor(Math.min(width, height) / 36))

  for (let row = step; row < height - step; row += step) {
    for (let col = step; col < width - step; col += step) {
      const index = (row * width + col) * stride
      const left = (row * width + (col - step)) * stride
      const up = ((row - step) * width + col) * stride

      const currentGray =
        imageData[index] * 0.299 +
        imageData[index + 1] * 0.587 +
        imageData[index + 2] * 0.114
      const leftGray =
        imageData[left] * 0.299 +
        imageData[left + 1] * 0.587 +
        imageData[left + 2] * 0.114
      const upGray =
        imageData[up] * 0.299 +
        imageData[up + 1] * 0.587 +
        imageData[up + 2] * 0.114

      brightnessTotal += currentGray
      edgeTotal += Math.abs(currentGray - leftGray) + Math.abs(currentGray - upGray)
      samples += 1
    }
  }

  if (!samples) return null

  return {
    brightness: brightnessTotal / samples,
    sharpness: edgeTotal / samples,
  }
}

const evaluateDetectedFace = (box, frameWidth, frameHeight) => {
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const widthRatio = box.width / frameWidth
  const heightRatio = box.height / frameHeight
  const centeredHorizontally = centerX > frameWidth * 0.16 && centerX < frameWidth * 0.84
  const centeredVertically = centerY > frameHeight * 0.14 && centerY < frameHeight * 0.86

  if (!centeredHorizontally || !centeredVertically) return 'off_center'
  if (widthRatio < 0.18 || heightRatio < 0.24) return 'too_small'
  if (widthRatio > 0.78 || heightRatio > 0.88) return 'too_large'

  return null
}

const getFaceDetectorUnavailableMessage = () => {
  if (!window.isSecureContext) {
    return 'Automatic face detection needs HTTPS or localhost. Open this page in a secure context and try again.'
  }

  return 'Automatic face detection could not be started on this browser session. Restart the camera and try again.'
}

const ensureFaceDetector = async () => {
  if (faceDetector || fallbackFaceDetector) return true

  if ('FaceDetector' in window) {
    try {
      faceDetector = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      })
      isDetectorFallbackMode.value = false
      return true
    } catch {
      faceDetector = null
    }
  }

  try {
    await tf.ready()
    if (!faceDetector) {
      fallbackFaceDetector = await blazeface.load()
      isDetectorFallbackMode.value = true
    } else {
      isDetectorFallbackMode.value = false
    }
    cameraError.value = ''
    detectionPhase.value = 'idle'
    return true
  } catch {
    isDetectorFallbackMode.value = false
    fallbackFaceDetector = null
    faceDetector = null
    cameraError.value = getFaceDetectorUnavailableMessage()
    detectionPhase.value = 'unsupported'
    return false
  }
}

const ensureLandmarkDetector = async () => {
  if (landmarkDetector) return true

  try {
    await tf.ready()
    landmarkDetector = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1,
      },
    )
    return true
  } catch {
    landmarkDetector = null
    return false
  }
}

const ensureObjectDetector = async () => {
  if (objectDetector) return true

  try {
    await tf.ready()
    objectDetector = await cocoSsd.load()
    return true
  } catch {
    objectDetector = null
    return false
  }
}

const getKeypoint = (keypoints, index) => {
  const point = keypoints?.[index]
  if (!point) return null

  const x = Array.isArray(point) ? point[0] : point.x
  const y = Array.isArray(point) ? point[1] : point.y

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

const averageKeypoints = (keypoints, indices) => {
  const points = indices.map((index) => getKeypoint(keypoints, index)).filter(Boolean)
  if (!points.length) return null

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  }
}

const getDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return 0
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y)
}

const getEyeAspectRatio = (keypoints, indices) => {
  const [leftCornerIndex, upperInnerIndex, upperOuterIndex, rightCornerIndex, lowerOuterIndex, lowerInnerIndex] = indices
  const leftCorner = getKeypoint(keypoints, leftCornerIndex)
  const upperInner = getKeypoint(keypoints, upperInnerIndex)
  const upperOuter = getKeypoint(keypoints, upperOuterIndex)
  const rightCorner = getKeypoint(keypoints, rightCornerIndex)
  const lowerOuter = getKeypoint(keypoints, lowerOuterIndex)
  const lowerInner = getKeypoint(keypoints, lowerInnerIndex)

  const horizontal = getDistance(leftCorner, rightCorner)
  if (horizontal <= 0) return 0

  const verticalA = getDistance(upperInner, lowerInner)
  const verticalB = getDistance(upperOuter, lowerOuter)

  return (verticalA + verticalB) / (2 * horizontal)
}

const FACE_OUTER_CONTOUR = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
  150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

const getPolylinePoints = (keypoints, indices) => indices.map((index) => getKeypoint(keypoints, index)).filter(Boolean)

const scalePolylinePoints = (points, scaleX = 1, scaleY = scaleX) => {
  if (!points.length) return points

  const bounds = points.reduce(
    (accumulator, point) => ({
      minX: Math.min(accumulator.minX, point.x),
      maxX: Math.max(accumulator.maxX, point.x),
      minY: Math.min(accumulator.minY, point.y),
      maxY: Math.max(accumulator.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  )

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return points.map((point) => ({
    x: centerX + (point.x - centerX) * scaleX,
    y: centerY + (point.y - centerY) * scaleY,
  }))
}

const drawSmoothPolyline = (context, points, closePath = false) => {
  if (points.length < 2) return

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)

  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y)
    if (closePath) context.closePath()
    context.stroke()
    return
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midpointX = (current.x + next.x) / 2
    const midpointY = (current.y + next.y) / 2
    context.quadraticCurveTo(current.x, current.y, midpointX, midpointY)
  }

  const lastPoint = points[points.length - 1]
  context.lineTo(lastPoint.x, lastPoint.y)
  if (closePath) context.closePath()
  context.stroke()
}

const getLandmarkFace = async (source) => {
  if (!(await ensureLandmarkDetector()) || !landmarkDetector) return null

  try {
    const faces = await landmarkDetector.estimateFaces(source, { flipHorizontal: false })
    if (faces.length !== 1) return null
    return faces[0] || null
  } catch {
    return null
  }
}

const evaluateFacingDirection = async (source) => {
  const landmarkFace = await getLandmarkFace(source)
  if (!landmarkFace) {
    return {
      state: 'look_straight',
      keypoints: [],
      averageEyeAspectRatio: 0,
      noseOffsetRatioSigned: 0,
    }
  }

  try {
    const keypoints = landmarkFace?.keypoints || []
    const leftEyeOuter = getKeypoint(keypoints, 33)
    const leftEyeInner = getKeypoint(keypoints, 133)
    const rightEyeInner = getKeypoint(keypoints, 362)
    const rightEyeOuter = getKeypoint(keypoints, 263)
    const leftIris = averageKeypoints(keypoints, [468, 469, 470, 471, 472])
    const rightIris = averageKeypoints(keypoints, [473, 474, 475, 476, 477])
    const noseTip = averageKeypoints(keypoints, [1, 4, 168])

    if (!leftEyeOuter || !leftEyeInner || !rightEyeInner || !rightEyeOuter || !leftIris || !rightIris || !noseTip) {
      return {
        state: 'look_straight',
        keypoints,
        averageEyeAspectRatio: 0,
        noseOffsetRatioSigned: 0,
      }
    }

    const leftEyeMinX = Math.min(leftEyeOuter.x, leftEyeInner.x)
    const leftEyeMaxX = Math.max(leftEyeOuter.x, leftEyeInner.x)
    const rightEyeMinX = Math.min(rightEyeInner.x, rightEyeOuter.x)
    const rightEyeMaxX = Math.max(rightEyeInner.x, rightEyeOuter.x)
    const leftEyeWidth = leftEyeMaxX - leftEyeMinX
    const rightEyeWidth = rightEyeMaxX - rightEyeMinX

    if (leftEyeWidth <= 1 || rightEyeWidth <= 1) {
      return {
        state: 'look_straight',
        keypoints,
        averageEyeAspectRatio: 0,
        noseOffsetRatioSigned: 0,
      }
    }

    const leftIrisRatio = (leftIris.x - leftEyeMinX) / leftEyeWidth
    const rightIrisRatio = (rightIris.x - rightEyeMinX) / rightEyeWidth
    const eyeCenter = {
      x: (leftIris.x + rightIris.x) / 2,
      y: (leftIris.y + rightIris.y) / 2,
    }
    const eyeDistance = Math.max(1, Math.abs(rightIris.x - leftIris.x))
    const eyeLineTiltRatio = Math.abs(leftIris.y - rightIris.y) / eyeDistance
    const noseOffsetRatioSigned = (noseTip.x - eyeCenter.x) / eyeDistance
    const noseOffsetRatio = Math.abs(noseOffsetRatioSigned)
    const leftEyeAspectRatio = getEyeAspectRatio(keypoints, [33, 160, 158, 133, 153, 144])
    const rightEyeAspectRatio = getEyeAspectRatio(keypoints, [362, 385, 387, 263, 373, 380])
    const averageEyeAspectRatio = (leftEyeAspectRatio + rightEyeAspectRatio) / 2

    const eyesCentered =
      leftIrisRatio >= MIN_IRIS_CENTER_RATIO &&
      leftIrisRatio <= MAX_IRIS_CENTER_RATIO &&
      rightIrisRatio >= MIN_IRIS_CENTER_RATIO &&
      rightIrisRatio <= MAX_IRIS_CENTER_RATIO

    if (!eyesCentered) return { state: 'look_straight', keypoints, averageEyeAspectRatio, noseOffsetRatioSigned }
    if (eyeLineTiltRatio > MAX_EYE_LINE_TILT_RATIO) return { state: 'look_straight', keypoints, averageEyeAspectRatio, noseOffsetRatioSigned }
    if (noseOffsetRatio > MAX_NOSE_OFFSET_RATIO && livenessStage.value !== 'turn') {
      return { state: 'look_straight', keypoints, averageEyeAspectRatio, noseOffsetRatioSigned }
    }

    return { state: null, keypoints, averageEyeAspectRatio, noseOffsetRatioSigned }
  } catch {
    return {
      state: null,
      keypoints: [],
      averageEyeAspectRatio: 0,
      noseOffsetRatioSigned: 0,
    }
  }
}

const detectFaces = async (source) => {
  if (faceDetector) {
    return await faceDetector.detect(source)
  }

  if (fallbackFaceDetector) {
    const predictions = await fallbackFaceDetector.estimateFaces(source, false)
    return predictions.map((prediction) => {
      const [left, top] = prediction.topLeft
      const [right, bottom] = prediction.bottomRight

      return {
        boundingBox: {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        },
      }
    })
  }

  return []
}

const detectPhoneInFrame = async (source) => {
  if (!(await ensureObjectDetector()) || !objectDetector) return false

  try {
    const predictions = await objectDetector.detect(source, 6, 0.35)
    return predictions.some((prediction) => prediction?.class === 'cell phone' && Number(prediction?.score || 0) >= 0.35)
  } catch {
    return false
  }
}

const completeLivenessCheck = () => {
  livenessStage.value = 'done'
  blinkStage.value = 'done'
  blinkChallengeStartedAt = 0
  blinkFailureUntil = 0
  baselineFaceCenterX = null
  baselineFaceCenterY = null
  baselineFaceWidth = null
  baselineFaceHeight = null
  steadyFrameCount = 0
}

const updateLivenessProgress = (facingResult) => {
  if (livenessStage.value === 'done') return true

  const averageEyeAspectRatio = facingResult?.averageEyeAspectRatio ?? 0
  const noseOffsetRatioSigned = facingResult?.noseOffsetRatioSigned ?? 0
  const now = Date.now()

  if (livenessStage.value === 'blink') {
    if (blinkFailureUntil && now < blinkFailureUntil) {
      detectionPhase.value = 'blink_failed'
      return false
    }

    if (blinkFailureUntil && now >= blinkFailureUntil) {
      blinkFailureUntil = 0
      blinkChallengeStartedAt = 0
      blinkStage.value = 'waiting_open'
    }

    if (!blinkChallengeStartedAt) {
      blinkChallengeStartedAt = now
    }

    detectionPhase.value = 'blink_once'

    if (blinkStage.value === 'waiting_open' && averageEyeAspectRatio >= MIN_EYE_OPEN_RATIO) {
      blinkStage.value = 'waiting_close'
    } else if (blinkStage.value === 'waiting_close' && averageEyeAspectRatio <= MAX_EYE_BLINK_RATIO) {
      blinkStage.value = 'waiting_reopen'
    } else if (blinkStage.value === 'waiting_reopen' && averageEyeAspectRatio >= MIN_EYE_REOPEN_RATIO) {
      completeLivenessCheck()
    }

    if (blinkChallengeStartedAt && now - blinkChallengeStartedAt >= BLINK_TIMEOUT_MS) {
      blinkFailureUntil = now + BLINK_FAIL_DISPLAY_MS
      blinkChallengeStartedAt = 0
      blinkStage.value = 'waiting_open'
      resetTrackingState()
      detectionPhase.value = 'blink_failed'
      return false
    }

    return false
  }

  return true
}

const startMockDetection = () => {
  clearDetectionTimer()
  clearDetectionLoop()
  isFaceScanning.value = true
  detectionPhase.value = 'align'
  detectionTimerId = window.setTimeout(() => {
    detectionTimerId = null
    detectionLoopId = window.setInterval(() => {
      void runDetection()
    }, 260)
  }, 450)
}

const stopCamera = () => {
  clearDetectionTimer()
  clearDetectionLoop()
  isCameraStarting.value = false
  if (stream.value) {
    for (const track of stream.value.getTracks()) {
      track.stop()
    }
  }

  stream.value = null
  isCameraReady.value = false
  resetDetectionProgress()
  resetLivenessState()
  clearSuccessTimer()
  resetGuideFrameBox()

  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

const startCamera = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Camera access is not supported in this browser.'
    return
  }
  stopCamera()
  resetLivenessState()
  isCameraStarting.value = true
  cameraError.value = ''
  if (!(await ensureFaceDetector())) {
    isCameraStarting.value = false
    return
  }
  await ensureLandmarkDetector()
  void ensureObjectDetector()

  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: selectedCameraMode.value,
        width: { ideal: 720 },
        height: { ideal: 960 },
      },
    })
    verificationMode.value = 'camera'
    isCameraReady.value = true
    isCameraStarting.value = false
    await syncVideoStream()
    startMockDetection()
  } catch {
    isCameraStarting.value = false
    cameraError.value = 'Camera access was blocked. Allow camera permission to continue.'
    detectionPhase.value = 'idle'
    verificationMode.value = 'guide'
  }
}

const switchCamera = async () => {
  selectedCameraMode.value = selectedCameraMode.value === 'user' ? 'environment' : 'user'
  await startCamera()
}

const completeVerification = (file) => {
  stopCamera()
  emit('selfie-selected', file)
  emit('complete')
}

const runDetection = async () => {
  if (
    isDetectionRunning ||
    (!faceDetector && !fallbackFaceDetector) ||
    !videoRef.value ||
    !isCameraReady.value ||
    isAutoSubmitting.value ||
    !videoRef.value.videoWidth ||
    !videoRef.value.videoHeight
  ) {
    return
  }

  isDetectionRunning = true

  try {
    const now = Date.now()

    if (phoneDetectedUntil && now < phoneDetectedUntil) {
      resetTrackingState()
      detectionPhase.value = 'phone_detected'
      resetGuideFrameBox()
      return
    }

    if (phoneDetectedUntil && now >= phoneDetectedUntil) {
      phoneDetectedUntil = 0
    }

    const faces = await detectFaces(videoRef.value)

    if (!faces.length) {
      resetTrackingState()
      detectionPhase.value = 'face_missing'
      resetGuideFrameBox()
      return
    }

    if (faces.length > 1) {
      resetTrackingState()
      detectionPhase.value = 'multiple_faces'
      resetGuideFrameBox()
      return
    }

    const primaryFace = faces[0]
    const box = primaryFace.boundingBox
    const frameWidth = videoRef.value.videoWidth
    const frameHeight = videoRef.value.videoHeight
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    updateGuideFrameBox(box, frameWidth, frameHeight)
    const faceState = evaluateDetectedFace(box, frameWidth, frameHeight)
    if (faceState) {
      resetTrackingState()
      detectionPhase.value = faceState
      return
    }

    const canvas = canvasRef.value
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return

    canvas.width = frameWidth
    canvas.height = frameHeight
    context.drawImage(videoRef.value, 0, 0, frameWidth, frameHeight)

    if (now - lastPhoneCheckAt >= PHONE_CHECK_INTERVAL_MS) {
      lastPhoneCheckAt = now
      const hasPhoneInFrame = await detectPhoneInFrame(canvas)
      if (hasPhoneInFrame) {
        resetTrackingState()
        resetLivenessState()
        phoneDetectedUntil = now + PHONE_DETECTED_DISPLAY_MS
        detectionPhase.value = 'phone_detected'
        resetGuideFrameBox()
        return
      }
    }

    const metrics = computeFaceMetrics(context, box, frameWidth, frameHeight)
    if (!metrics || metrics.sharpness < MIN_FACE_SHARPNESS || metrics.brightness < MIN_FACE_BRIGHTNESS) {
      resetTrackingState()
      detectionPhase.value = 'too_blurry'
      return
    }

    const facingResult = await evaluateFacingDirection(canvas)
    updateGuideFrameBox(box, frameWidth, frameHeight, facingResult?.keypoints || [])
    if (facingResult?.state) {
      resetTrackingState()
      detectionPhase.value = facingResult.state
      return
    }

    if (!updateLivenessProgress(facingResult)) {
      isFaceScanning.value = true
      return
    }

    isFaceScanning.value = true

    if (!baselineFaceCenterX) {
      baselineFaceCenterX = centerX
      baselineFaceCenterY = centerY
      baselineFaceWidth = box.width
      baselineFaceHeight = box.height
      steadyFrameCount = 1
      detectionPhase.value = 'align'
      return
    }

    const horizontalDrift = Math.abs(centerX - baselineFaceCenterX)
    const verticalDrift = Math.abs(centerY - (baselineFaceCenterY || centerY))
    const widthDrift = Math.abs(box.width - (baselineFaceWidth || box.width))
    const heightDrift = Math.abs(box.height - (baselineFaceHeight || box.height))
    const isSteady =
      horizontalDrift <= frameWidth * 0.065 &&
      verticalDrift <= frameHeight * 0.07 &&
      widthDrift <= frameWidth * 0.075 &&
      heightDrift <= frameHeight * 0.085

    if (detectionPhase.value === 'align' || detectionPhase.value === 'idle') {
      if (isSteady) {
        steadyFrameCount += facingResult?.state ? 1 : 2
      } else {
        baselineFaceCenterX = centerX
        baselineFaceCenterY = centerY
        baselineFaceWidth = box.width
        baselineFaceHeight = box.height
        steadyFrameCount = 0
      }

      if (steadyFrameCount >= 3) {
        detectionPhase.value = 'verifying'
        isFaceDetected.value = true
        clearDetectionLoop()
        void autoCaptureAndContinue()
      }
      return
    }
  } catch {
    cameraError.value = 'Live face detection failed. Please restart the camera and try again.'
    detectionPhase.value = 'idle'
    clearDetectionLoop()
  } finally {
    isDetectionRunning = false
  }
}

const captureSelfieFromVideo = async () => {
  if (!videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  const width = video.videoWidth
  const height = video.videoHeight

  if (!width || !height) return

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.drawImage(video, 0, 0, width, height)
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }

      resolve(
        new File([blob], `selfie-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }),
      )
    }, 'image/jpeg', 0.92)
  })
}

const autoCaptureAndContinue = async () => {
  if (isAutoSubmitting.value || !isFaceDetected.value) return
  if (livenessStage.value !== 'done') return
  isAutoSubmitting.value = true

  if ((faceDetector || fallbackFaceDetector) && videoRef.value && canvasRef.value && videoRef.value.videoWidth && videoRef.value.videoHeight) {
    const frameWidth = videoRef.value.videoWidth
    const frameHeight = videoRef.value.videoHeight
    const canvas = canvasRef.value
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) {
      isAutoSubmitting.value = false
      return
    }

    canvas.width = frameWidth
    canvas.height = frameHeight
    context.drawImage(videoRef.value, 0, 0, frameWidth, frameHeight)

    try {
      const faces = await detectFaces(canvas)
      if (faces.length !== 1) {
        resetTrackingState()
        detectionPhase.value = faces.length > 1 ? 'multiple_faces' : 'face_missing'
        resetGuideFrameBox()
        isAutoSubmitting.value = false
        startMockDetection()
        return
      }

      const finalBox = faces[0].boundingBox
      const finalFaceState = evaluateDetectedFace(finalBox, frameWidth, frameHeight)
      const finalMetrics = computeFaceMetrics(context, finalBox, frameWidth, frameHeight)

      if (finalFaceState) {
        resetTrackingState()
        detectionPhase.value = finalFaceState
        resetGuideFrameBox()
        isAutoSubmitting.value = false
        startMockDetection()
        return
      }

      if (
        !finalMetrics ||
        finalMetrics.sharpness < MIN_FACE_SHARPNESS ||
        finalMetrics.brightness < MIN_FACE_BRIGHTNESS
      ) {
        resetTrackingState()
        detectionPhase.value = 'too_blurry'
        resetGuideFrameBox()
        isAutoSubmitting.value = false
        startMockDetection()
        return
      }

      const finalFacingResult = await evaluateFacingDirection(canvas)
      if (finalFacingResult?.state) {
        resetTrackingState()
        detectionPhase.value = finalFacingResult.state
        resetGuideFrameBox()
        isAutoSubmitting.value = false
        startMockDetection()
        return
      }
    } catch {
      resetTrackingState()
      cameraError.value = 'Final face check failed. Please try again.'
      detectionPhase.value = 'idle'
      isAutoSubmitting.value = false
      startMockDetection()
      return
    }
  }

  const file = await captureSelfieFromVideo()
  if (!file) {
    isAutoSubmitting.value = false
    return
  }
  isScanSuccessful.value = true
  clearSuccessTimer()
  successTimerId = window.setTimeout(() => {
    successTimerId = null
    completeVerification(file)
  }, 900)
}

const handleSelfieUpload = (event) => {
  const file = event?.target?.files?.[0] || null
  if (!file) return
  completeVerification(file)
}

watch(
  () => props.hasSelfie,
  (value) => {
    emit('status-change', value)
  },
)

watch(
  () => props.autoStart,
  (value) => {
    if (!value || props.hasSelfie || isCameraReady.value || isAutoSubmitting.value) return
    void startCamera()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearSuccessTimer()
  stopCamera()
})

defineExpose({
  stopCamera,
})
</script>

<template>
  <section class="client-verification">
    <div class="client-verification__shell">
      <header class="client-verification__header">
        <p class="client-verification__brand">{{ props.headerEyebrow }}</p>
        <h3>{{ props.headerTitle }}</h3>
        <p>{{ props.headerDescription }}</p>
      </header>

      <div class="client-verification__steps" aria-label="Verification steps">
        <div
          class="client-verification__step"
          :class="{ 'is-active': !props.hasSelfie, 'is-done': props.hasSelfie }"
        >
          <span>1</span>
          <small>Selfie</small>
        </div>
        <span class="client-verification__line" :class="{ 'is-done': props.hasSelfie || isFaceDetected }" />
        <div
          class="client-verification__step"
          :class="{ 'is-active': isFaceDetected && !props.hasSelfie, 'is-done': props.hasSelfie }"
        >
          <span>2</span>
          <small>Proceed</small>
        </div>
      </div>

      <div class="client-verification__panel">
        <div class="client-verification__copy">
          <h4>Face Scan Required</h4>
          <p>
            {{
              isDetectorFallbackMode
                ? 'Automatic face scan fallback is active. Keep your face centered and still for auto capture.'
                : 'Blurred faces, missing faces, and non-face objects should not pass this check. Hold still once your face is clear and centered.'
            }}
          </p>
        </div>

        <div ref="viewerRef" class="client-verification__viewer">
          <video
            v-if="verificationMode === 'camera' && isCameraReady"
            ref="videoRef"
            class="client-verification__video"
            autoplay
            muted
            playsinline
          />
          <div v-else class="client-verification__placeholder">
          </div>
          <div v-if="isCameraStarting" class="client-verification__loading">
            <span class="client-verification__loading-spinner" aria-hidden="true" />
            <span>Starting camera...</span>
          </div>
          <div class="client-verification__overlay" aria-hidden="true">
            <div v-if="!isCameraStarting" class="client-verification__scan-frame" :style="scanFrameStyle">
              <div class="client-verification__scan-corners">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div class="client-verification__scan-depth">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div class="client-verification__scan-grid">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div class="client-verification__scan-guide" />
              <div class="client-verification__scan-orbit" :class="{ 'is-locked': isFaceDetected || isAutoSubmitting || isScanSuccessful }" />
            </div>
            <div v-if="isScanSuccessful" class="client-verification__success-badge">
              <i class="bi bi-check-circle-fill" />
              <span>Face verified</span>
            </div>
            <p :class="overlayMessageClass">{{ statusMessage }}</p>
          </div>
          <canvas ref="canvasRef" class="client-verification__canvas" />
        </div>

        <p v-if="inlineErrorMessage" class="client-verification__error">{{ inlineErrorMessage }}</p>

        <div class="client-verification__actions">
          <button type="button" class="client-verification__btn client-verification__btn--primary" :disabled="isCameraStarting" @click="startCamera">
            {{ isCameraStarting ? 'Starting Camera...' : isCameraReady ? 'Restart Camera' : 'Open Camera' }}
          </button>
          <button
            v-if="isCameraReady"
            type="button"
            class="client-verification__btn client-verification__btn--ghost"
            @click="switchCamera"
          >
            Switch Camera
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped src="@/authenticator/Face_Recognition/face_verify.css"></style>
