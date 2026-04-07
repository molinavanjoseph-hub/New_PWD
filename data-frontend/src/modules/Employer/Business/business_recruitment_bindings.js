import { computed, ref } from 'vue'

export const createRecruitmentState = (ctx = {}) => {
  const {
    JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION,
    JOB_POSTING_BARANGAYS,
    JOB_POSTING_DISABILITY_TYPES,
    JOB_POSTING_LANGUAGE_OPTIONS,
    JOB_POSTING_MAX_VACANCIES,
    profileForm,
    businessCategory,
    businessName,
    authUser,
    businessAvatar,
    canEditBusinessModule,
    showPaymentToast,
    showPaymentConfirmationToast,
    createBusinessJobPost,
    updateBusinessJobPost,
    deleteBusinessJobPost,
    updateApplicantJobApplicationStatus,
    saveBusinessInterviewSchedule,
    saveBusinessAssessmentAssignmentRecord,
    subscribeToWorkspaceJobs,
    getWorkspaceOwnerDirectoryId,
    logBusinessStartupSyncIssue,
    businessJobApplications,
    businessInterviewSchedules,
    assessmentAssignmentRecords,
    canUpdateApplicantManagementStatus,
  } = ctx

  const resolveJobPostingBusinessCategory = (fallback = '') =>
    String(profileForm.value.category || businessCategory.value || fallback || '').trim()
  const JOB_POSTING_DISABILITY_TYPE_LOOKUP = new Map(
    JOB_POSTING_DISABILITY_TYPES.map((entry) => [
      String(entry?.value || '').trim(),
      String(entry?.label || entry?.value || '').trim(),
    ]),
  )
  const normalizeJobPostingDisabilityTypes = (value) => {
    const sourceValues = Array.isArray(value) ? value : [value]

    return [...new Set(
      sourceValues
        .flatMap((entry) => String(entry || '').split(/[\r\n,]+/))
        .map((entry) => entry.trim())
        .filter(Boolean),
    )]
  }
  const serializeJobPostingDisabilityTypes = (value) =>
    normalizeJobPostingDisabilityTypes(value).join(', ')
  const resolveJobPostingDisabilityTypeLabel = (value) =>
    JOB_POSTING_DISABILITY_TYPE_LOOKUP.get(String(value || '').trim()) || String(value || '').trim()

  const createJobPostingDraft = () => ({
    title: '',
    description: '',
    category: resolveJobPostingBusinessCategory(),
    type: '',
    location: 'Dasmarinas City',
    barangay: '',
    vacancies: '',
    salaryRange: '',
    disabilityType: '',
    impairmentSpecification: '',
    preferredAgeRange: '',
    language: '',
    qualifications: '',
    responsibilities: '',
    status: 'open',
  })

  const jobPostingTab = ref('create')
  const jobPostingDraft = ref(createJobPostingDraft())
  const jobPostingOpenDropdown = ref('')
  const jobPostingTypeDropdownRef = ref(null)
  const jobPostingBarangayDropdownRef = ref(null)
  const jobPostingDisabilityDropdownRef = ref(null)
  const jobPostingLanguageDropdownRef = ref(null)
  const editingJobPostId = ref('')
  const openJobPostActionMenuId = ref('')
  const jobPostPendingAction = ref({
    jobId: '',
    action: '',
  })
  const jobPostingCompanyNameDisplay = computed(() =>
    String(profileForm.value.companyName || businessName.value || '').trim(),
  )
  const jobPostingCategoryValue = computed(() =>
    resolveJobPostingBusinessCategory(jobPostingDraft.value.category),
  )
  const jobPostingCategoryLabel = computed(() =>
    jobPostingCategoryValue.value || 'Set business category in profile',
  )
  const formatPostedJobDateLabel = (value, prefix = 'Posted') => {
    const raw = String(value || '').trim()
    const parsedValue = raw ? Date.parse(raw) : 0
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) return `${prefix} recently`

    return `${prefix} ${new Date(parsedValue).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })}`
  }
  const normalizePostedJobStatus = (status) => {
    const normalizedStatus = String(status || '').trim().toLowerCase()
    if (normalizedStatus === 'closed') return 'Closed'
    if (normalizedStatus === 'draft') return 'Draft'
    return 'Open'
  }
  const jobPostingPreviewStatusLabel = computed(() => normalizePostedJobStatus(jobPostingDraft.value.status))
  const jobPostingCreatedPreview = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date())
  const toJobPostingLineItems = (value) =>
    String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  const jobPostingQualificationsPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.qualifications))
  const jobPostingResponsibilitiesPreview = computed(() => toJobPostingLineItems(jobPostingDraft.value.responsibilities))
  const jobPostingSelectedDisabilityTypes = computed(() =>
    normalizeJobPostingDisabilityTypes(jobPostingDraft.value.disabilityType),
  )
  const jobPostingDisabilityTypeNeedsSpecification = computed(() =>
    jobPostingSelectedDisabilityTypes.value.some((entry) =>
      JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(entry || '').trim()),
    ),
  )
  const jobPostingTypeLabel = computed(() =>
    String(jobPostingDraft.value.type || '').trim() || 'Select job type',
  )
  const jobPostingBarangayLabel = computed(() =>
    JOB_POSTING_BARANGAYS.find((entry) => entry.value === jobPostingDraft.value.barangay)?.label || 'Select barangay',
  )
  const jobPostingDisabilityLabel = computed(() => {
    const selectedLabels = jobPostingSelectedDisabilityTypes.value
      .map((entry) => resolveJobPostingDisabilityTypeLabel(entry))
      .filter(Boolean)

    if (!selectedLabels.length) return 'Select disability types'
    if (selectedLabels.length <= 2) return selectedLabels.join(', ')
    return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`
  })
  const jobPostingLanguageLabel = computed(() =>
    JOB_POSTING_LANGUAGE_OPTIONS.find((entry) => entry.value === jobPostingDraft.value.language)?.label || 'Select language',
  )
  const parseJobPostingCurrencyNumber = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '')
    return digits ? Number(digits) : 0
  }
  const normalizePreferredAgeRangeInput = (value) =>
    String(value || '')
      .replace(/[^\d]/g, '')
      .slice(0, 3)
  const parseJobPostingSalaryRange = (value) => {
    const raw = String(value || '').trim()
    if (!raw) {
      return { min: 0, max: 0, label: '', isValid: false }
    }

    const parts = raw.split('-').map((part) => parseJobPostingCurrencyNumber(part))
    if (parts.length < 2 || parts[0] <= 0 || parts[1] <= 0) {
      return { min: 0, max: 0, label: '', isValid: false }
    }

    const min = Math.min(parts[0], parts[1])
    const max = Math.max(parts[0], parts[1])

    return {
      min,
      max,
      label: `PHP ${min.toLocaleString('en-US')} - PHP ${max.toLocaleString('en-US')}`,
      isValid: true,
    }
  }
  const formatJobPostingSalarySide = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '')
    if (!digits) return ''
    return `PHP ${Number(digits).toLocaleString('en-US')}`
  }
  const formatJobPostingSalaryRangeInput = (value) => {
    const raw = String(value || '')
    const hasDash = raw.includes('-')
    const [leftRaw = '', rightRaw = ''] = raw.split('-', 2)
    const left = formatJobPostingSalarySide(leftRaw)
    const right = formatJobPostingSalarySide(rightRaw)

    if (hasDash) {
      if (left && right) return `${left} - ${right}`
      if (left) return `${left} - `
      if (right) return `- ${right}`
      return '- '
    }

    return left
  }
  const jobPostingSalaryPreview = computed(() => {
    const { min: parsedMin, max: parsedMax, label } = parseJobPostingSalaryRange(jobPostingDraft.value.salaryRange)
    if (label) return label
    const min = parsedMin > 0 && parsedMax > 0 ? Math.min(parsedMin, parsedMax) : parsedMin
    const max = parsedMin > 0 && parsedMax > 0 ? Math.max(parsedMin, parsedMax) : parsedMax
    if (min > 0 && max > 0) return `PHP ${min.toLocaleString('en-US')} - PHP ${max.toLocaleString('en-US')}`
    if (min > 0) return `PHP ${min.toLocaleString('en-US')} - Negotiable`
    if (max > 0) return `Negotiable - PHP ${max.toLocaleString('en-US')}`
    return 'Negotiable'
  })
  const isSavingJobPost = ref(false)
  const isPostedJobsLoading = ref(false)
  const postedJobsSyncMessage = ref('')
  const postedJobs = ref([])
  let stopWorkspaceJobsSync = () => {}
  const toggleJobPostingDropdown = (dropdownId) => {
    jobPostingOpenDropdown.value = jobPostingOpenDropdown.value === dropdownId ? '' : dropdownId
  }
  const closeJobPostingDropdown = () => {
    jobPostingOpenDropdown.value = ''
  }
  const isJobPostingDropdownOpen = (dropdownId) => jobPostingOpenDropdown.value === dropdownId
  const selectJobPostingDropdownValue = (key, value) => {
    handleJobPostingFieldChange(key, value)
    closeJobPostingDropdown()
  }
  const createPostedJobRecord = (record = {}) => ({
    id: String(record.id || '').trim(),
    title: String(record.title || '').trim() || 'Untitled job post',
    description: String(record.description || '').trim(),
    category: resolveJobPostingBusinessCategory(record.category || 'General') || 'General',
    location: String(
      record.location
      || [record.city, record.barangay].filter((value) => String(value || '').trim()).join(', ')
      || 'Not specified',
    ).trim(),
    city: String(record.city || record.location || 'Dasmarinas City').trim() || 'Dasmarinas City',
    barangay: String(record.barangay || '').trim(),
    workType: String(record.type || record.setup || 'Open').trim(),
    setup: String(record.setup || record.type || '').trim(),
    vacancies: Math.max(1, Number(record.vacancies || 1) || 1),
    salary: String(record.salary || record.salaryRange || 'Negotiable').trim(),
    salaryRange: String(record.salaryRange || record.salary || 'Negotiable').trim(),
    disabilityType: serializeJobPostingDisabilityTypes(record.disabilityType || record.disabilityTypes),
    impairmentSpecification: String(record.impairmentSpecification || '').trim(),
    preferredAgeRange: String(record.preferredAgeRange || '').trim(),
    language: String(record.language || '').trim(),
    qualifications: Array.isArray(record.qualifications) ? record.qualifications.map((item) => String(item || '').trim()).filter(Boolean) : [],
    responsibilities: Array.isArray(record.responsibilities) ? record.responsibilities.map((item) => String(item || '').trim()).filter(Boolean) : [],
    status: normalizePostedJobStatus(record.status),
    createdAt: String(record.createdAt || record.created_at || '').trim(),
    updatedAt: String(record.updatedAt || record.updated_at || '').trim(),
    updated: formatPostedJobDateLabel(record.updatedAt || record.updated_at || record.createdAt || record.created_at, 'Updated'),
    posted: formatPostedJobDateLabel(record.createdAt || record.created_at || record.updatedAt || record.updated_at, 'Posted'),
    workspaceOwnerId: String(record.workspaceOwnerId || record.workspace_owner_id || '').trim(),
  })
  const syncPostedJobRecordLocally = (record = {}) => {
    const nextRecord = createPostedJobRecord(record)
    if (!nextRecord.id) return

    postedJobs.value = [
      nextRecord,
      ...postedJobs.value.filter((job) => String(job?.id || '').trim() !== nextRecord.id),
    ].sort((left, right) => {
      const leftTime = Date.parse(String(left?.updatedAt || left?.createdAt || '')) || 0
      const rightTime = Date.parse(String(right?.updatedAt || right?.createdAt || '')) || 0
      return rightTime - leftTime
    })
  }
  const postedJobsSummary = computed(() => {
    const openCount = postedJobs.value.filter((job) => String(job.status || '').trim().toLowerCase() === 'open').length
    const draftCount = postedJobs.value.filter((job) => String(job.status || '').trim().toLowerCase() === 'draft').length
    const totalVacancies = postedJobs.value.reduce(
      (total, job) => total + (Math.max(1, Number(job.vacancies || 1) || 1)),
      0,
    )

    return {
      openCount,
      draftCount,
      totalVacancies,
    }
  })
  const normalizeBusinessWorkflowJobLookupValue = (value) =>
    String(value || '').trim().toLowerCase()
  const businessPostedJobIds = computed(() =>
    new Set(
      postedJobs.value
        .map((job) => String(job?.id || '').trim())
        .filter(Boolean),
    ),
  )
  const businessPostedJobTitles = computed(() =>
    new Set(
      postedJobs.value
        .map((job) => normalizeBusinessWorkflowJobLookupValue(job?.title))
        .filter(Boolean),
    ),
  )
  const isBusinessApplicationLinkedToPostedJob = (application = {}) => {
    const jobId = String(application?.jobId || application?.job_id || '').trim()
    if (jobId) return businessPostedJobIds.value.has(jobId)

    const jobTitle = normalizeBusinessWorkflowJobLookupValue(application?.jobTitle || application?.job_title)
    if (jobTitle) return businessPostedJobTitles.value.has(jobTitle)

    return false
  }
  const jobPostHighlights = computed(() => [
    {
      label: 'Active Posts',
      value: 'Unlimited',
    },
    { label: 'Live Listings', value: String(postedJobsSummary.value.openCount) },
    { label: 'Total Vacancies', value: String(postedJobsSummary.value.totalVacancies) },
  ])
  const resolvePostedJobStatusClass = (status) => {
    const normalizedStatus = String(status || '').trim().toLowerCase()
    if (normalizedStatus === 'open') return 'is-open'
    if (normalizedStatus === 'draft') return 'is-draft'
    if (normalizedStatus === 'closed') return 'is-closed'
    return ''
  }
  const isEditingJobPost = computed(() => Boolean(String(editingJobPostId.value || '').trim()))
  const createJobPostingDraftFromRecord = (job = {}) => ({
    title: String(job.title || '').trim(),
    description: String(job.description || '').trim(),
    category: resolveJobPostingBusinessCategory(job.category),
    type: String(job.workType || '').trim(),
    location: String(job.city || 'Dasmarinas City').trim() || 'Dasmarinas City',
    barangay: String(job.barangay || '').trim(),
    vacancies: String(job.vacancies || ''),
    salaryRange: String(job.salaryRange || job.salary || '').trim(),
    disabilityType: serializeJobPostingDisabilityTypes(job.disabilityType || job.disabilityTypes),
    impairmentSpecification: String(job.impairmentSpecification || '').trim(),
    preferredAgeRange: String(job.preferredAgeRange || '').trim(),
    language: String(job.language || '').trim(),
    qualifications: Array.isArray(job.qualifications) ? job.qualifications.join('\n') : '',
    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : '',
    status: String(job.status || 'Open').trim().toLowerCase() || 'open',
  })
  const resetJobPostingDraft = () => {
    editingJobPostId.value = ''
    jobPostingDraft.value = createJobPostingDraft()
  }
  const closeJobPostActionMenu = () => {
    openJobPostActionMenuId.value = ''
  }
  const toggleJobPostActionMenu = (jobId) => {
    const normalizedJobId = String(jobId || '').trim()
    if (!normalizedJobId || !canEditBusinessModule('job-posting')) return

    openJobPostActionMenuId.value = openJobPostActionMenuId.value === normalizedJobId ? '' : normalizedJobId
  }
  const isJobPostActionPending = (jobId, action = '') =>
    jobPostPendingAction.value.jobId === String(jobId || '').trim()
    && (!action || jobPostPendingAction.value.action === action)
  const startEditingJobPost = (jobId) => {
    const normalizedJobId = String(jobId || '').trim()
    const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

    if (!selectedJob) {
      showPaymentToast('That job post could not be found.', 'error')
      return
    }

    editingJobPostId.value = normalizedJobId
    jobPostingDraft.value = createJobPostingDraftFromRecord(selectedJob)
    jobPostingTab.value = 'create'
    closeJobPostActionMenu()
  }
  const cancelJobPostEditing = () => {
    resetJobPostingDraft()
    jobPostingTab.value = 'posted'
  }
  const buildJobPostingDisabilityFitLabel = (disabilityType, impairmentSpecification) => {
    const category = normalizeJobPostingDisabilityTypes(disabilityType)
      .map((entry) => resolveJobPostingDisabilityTypeLabel(entry))
      .join(', ')
    const specification = String(impairmentSpecification || '').trim()
    if (category && specification) return `${category} - ${specification}`
    return category || specification
  }
  const getJobPostingImpairmentSpecificationPlaceholder = (disabilityType) => {
    const normalizedDisabilityTypes = normalizeJobPostingDisabilityTypes(disabilityType)

    if (normalizedDisabilityTypes.length > 1) {
      return 'Example: Limited hand mobility, low vision, hard of hearing'
    }

    switch (normalizedDisabilityTypes[0] || '') {
      case 'Physical Impairment':
        return 'Example: Right leg, left arm, limited hand mobility'
      case 'Visual Impairment':
        return 'Example: Low vision, blind in right eye, legally blind'
      case 'Deaf or Hard of Hearing':
        return 'Example: Deaf, hard of hearing, bilateral hearing loss'
      case 'Hearing Impairment':
        return 'Example: Left ear, right ear, bilateral hearing loss'
      case 'Speech and Language Impairment':
        return 'Example: Stuttering, articulation disorder, expressive language'
      case 'Chronic Illness / Medical Condition':
        return 'Example: Chronic kidney disease, heart condition'
      case 'Multiple Disabilities':
        return 'Example: Visual impairment and hearing impairment'
      default:
        return 'Enter impairment specification'
    }
  }
  const closeJobPostingDropdownOnOutsideClick = (event) => {
    const target = event?.target
    if (!target) return

    const clickedInsideJobPostingDropdown = [
      jobPostingTypeDropdownRef.value,
      jobPostingBarangayDropdownRef.value,
      jobPostingDisabilityDropdownRef.value,
      jobPostingLanguageDropdownRef.value,
    ].some((entry) => entry?.contains?.(target))

    if (!clickedInsideJobPostingDropdown) {
      closeJobPostingDropdown()
    }
  }
  const handleJobPostingFieldChange = (key, value) => {
    if (key === 'disabilityType') {
      const normalizedDisabilityType = serializeJobPostingDisabilityTypes(value)
      const shouldKeepSpecification = normalizeJobPostingDisabilityTypes(normalizedDisabilityType).some((entry) =>
        JOB_POSTING_DISABILITY_TYPES_REQUIRING_SPECIFICATION.has(String(entry || '').trim()),
      )

      jobPostingDraft.value = {
        ...jobPostingDraft.value,
        disabilityType: normalizedDisabilityType,
        impairmentSpecification: shouldKeepSpecification ? jobPostingDraft.value.impairmentSpecification : '',
      }
      return
    }

    if (key === 'salaryRange') {
      jobPostingDraft.value = {
        ...jobPostingDraft.value,
        salaryRange: formatJobPostingSalaryRangeInput(value),
      }
      return
    }

    if (key === 'preferredAgeRange') {
      jobPostingDraft.value = {
        ...jobPostingDraft.value,
        preferredAgeRange: normalizePreferredAgeRangeInput(value),
      }
      return
    }

    jobPostingDraft.value = {
      ...jobPostingDraft.value,
      [key]: value,
    }
  }
  const updateJobPostStatus = async (jobId, nextStatus) => {
    const normalizedJobId = String(jobId || '').trim()
    const normalizedStatus = String(nextStatus || '').trim().toLowerCase()
    const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

    if (!selectedJob || !normalizedStatus) {
      showPaymentToast('That job post could not be updated right now.', 'error')
      return
    }

    const actionLabel = normalizedStatus === 'closed' ? 'close' : 'open'
    const confirmMessage = normalizedStatus === 'closed'
      ? `Close "${selectedJob.title}"? It will be hidden from the landing page until opened again.`
      : `Open "${selectedJob.title}"? It will appear again on the landing page and public job lists.`
    closeJobPostActionMenu()
    showPaymentConfirmationToast({
      title: normalizedStatus === 'closed' ? 'Close' : 'Open',
      message: confirmMessage,
      confirmLabel: normalizedStatus === 'closed' ? 'Close' : 'Open',
      confirmVariant: normalizedStatus === 'closed' ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          jobPostPendingAction.value = {
            jobId: normalizedJobId,
            action: actionLabel,
          }
          await updateBusinessJobPost(normalizedJobId, {
            status: normalizedStatus,
            workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
          })

          if (editingJobPostId.value === normalizedJobId) {
            jobPostingDraft.value = {
              ...jobPostingDraft.value,
              status: normalizedStatus,
            }
          }

          showPaymentToast(
            normalizedStatus === 'closed'
              ? 'Job closed. It is now hidden from the public job feed.'
              : 'Job opened. It is visible again on the public job feed.',
            'success',
          )
        } catch (error) {
          showPaymentToast(error instanceof Error ? error.message : 'Unable to update the job post status right now.', 'error')
        } finally {
          jobPostPendingAction.value = {
            jobId: '',
            action: '',
          }
        }
      },
    })
  }
  const permanentlyDeleteJobPost = async (jobId) => {
    const normalizedJobId = String(jobId || '').trim()
    const selectedJob = postedJobs.value.find((job) => job.id === normalizedJobId)

    if (!selectedJob) {
      showPaymentToast('That job post could not be found.', 'error')
      return
    }

    closeJobPostActionMenu()
    showPaymentConfirmationToast({
      title: 'Delete Job Post',
      message: `Delete "${selectedJob.title}" permanently? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          jobPostPendingAction.value = {
            jobId: normalizedJobId,
            action: 'delete',
          }
          const reviewerId = String(authUser.value?.id || authUser.value?.uid || '').trim()
          const reviewerName = String(authUser.value?.name || businessName.value || 'Business Owner').trim()
          const decisionAt = new Date().toISOString()
          const normalizedJobTitle = String(selectedJob.title || 'this job post').trim() || 'this job post'
          const applicationDiscontinuationReason = `The job post "${normalizedJobTitle}" was deleted by the business. This application was discontinued.`
          const buildInterviewCancellationReason = (application = {}, schedule = {}) => {
            return `The job post "${normalizedJobTitle}" was deleted by the business. The interview was cancelled and the application was discontinued.`
          }
          const assessmentDiscontinuationReason = `The job post "${normalizedJobTitle}" was deleted by the business. This technical assessment was discontinued because the application was discontinued.`
          const affectedApplications = businessJobApplications.value.filter((application) =>
            String(application?.jobId || application?.job_id || '').trim() === normalizedJobId
            && canUpdateApplicantManagementStatus(application?.status),
          )
          const affectedApplicationIds = new Set(
            affectedApplications.map((application) => String(application?.id || '').trim()).filter(Boolean),
          )
          const relatedInterviewSchedules = businessInterviewSchedules.value.filter((record) =>
            affectedApplicationIds.has(String(record?.applicationId || record?.application_id || '').trim()))
          const relatedAssessmentAssignments = assessmentAssignmentRecords.value.filter((record) =>
            affectedApplicationIds.has(String(record?.applicationId || record?.application_id || record?.id || '').trim()))
          const assessmentAssignmentsByApplicationId = new Map()
          relatedAssessmentAssignments.forEach((record) => {
            const applicationId = String(record?.applicationId || record?.application_id || record?.id || '').trim()
            if (!applicationId) return
            const existingRows = assessmentAssignmentsByApplicationId.get(applicationId) || []
            assessmentAssignmentsByApplicationId.set(applicationId, [...existingRows, record])
          })

          await Promise.all([
            ...affectedApplications.map((application) => {
              const applicationId = String(application?.id || '').trim()
              if (!applicationId) return Promise.resolve()
              const hasInterviewMirror = Boolean(String(
                application?.interviewDate
                  || application?.interview_date
                  || application?.interviewSchedule
                  || application?.interview_schedule
                  || '',
              ).trim())
              const interviewDecisionReason = hasInterviewMirror ? buildInterviewCancellationReason(application) : undefined
              const hasAssessmentAssignment = assessmentAssignmentsByApplicationId.has(applicationId)

              return updateApplicantJobApplicationStatus(applicationId, {
                status: 'discontinued',
                rejectionReason: applicationDiscontinuationReason,
                reviewedBy: reviewerId,
                reviewedByName: reviewerName,
                interviewDecisionReason,
                interviewDecidedAt: interviewDecisionReason ? decisionAt : undefined,
                technicalAssessmentStatus: hasAssessmentAssignment ? 'cancelled' : undefined,
              })
            }),
            ...relatedInterviewSchedules.map((schedule) => {
              const applicationId = String(schedule?.applicationId || schedule?.application_id || '').trim()
              const linkedApplication = affectedApplications.find((application) => String(application?.id || '').trim() === applicationId) || {}
              return saveBusinessInterviewSchedule({
                ...schedule,
                scheduleStatus: 'cancelled',
                businessDecisionReason: buildInterviewCancellationReason(linkedApplication, schedule),
                businessDecidedAt: decisionAt,
                availableScheduleOptions: [],
              })
            }),
            ...relatedAssessmentAssignments.map((assignment) =>
              saveBusinessAssessmentAssignmentRecord({
                ...assignment,
                assignmentStatus: 'Cancelled',
                assessmentStatus: 'cancelled',
                cancellationReason: assessmentDiscontinuationReason,
              })),
          ])

          await deleteBusinessJobPost(normalizedJobId, {
            workspaceOwnerId: selectedJob.workspaceOwnerId || getWorkspaceOwnerDirectoryId(),
          })

          if (editingJobPostId.value === normalizedJobId) {
            resetJobPostingDraft()
            jobPostingTab.value = 'posted'
          }

          const affectedApplicationCount = affectedApplications.length
          showPaymentToast(
            affectedApplicationCount
              ? `Job post deleted permanently. ${affectedApplicationCount} application${affectedApplicationCount === 1 ? ' was' : 's were'} discontinued.`
              : 'Job post deleted permanently.',
            'success',
          )
        } catch (error) {
          showPaymentToast(error instanceof Error ? error.message : 'Unable to delete the job post right now.', 'error')
        } finally {
          jobPostPendingAction.value = {
            jobId: '',
            action: '',
          }
        }
      },
    })
  }
  const saveJobPost = async () => {
    if (!canEditBusinessModule('job-posting')) {
      showPaymentToast('Your role has view-only access for Job Posting.', 'warning')
      return false
    }

    if (isSavingJobPost.value) return false

    const requiredFields = [
      ['job title', jobPostingDraft.value.title],
      ['company name', jobPostingCompanyNameDisplay.value],
      ['description', jobPostingDraft.value.description],
      ['business category', jobPostingCategoryValue.value],
      ['type', jobPostingDraft.value.type],
      ['location', jobPostingDraft.value.location],
      ['barangay', jobPostingDraft.value.barangay],
      ['vacancies', jobPostingDraft.value.vacancies],
      ['salary range', jobPostingDraft.value.salaryRange],
      ['disability type', jobPostingDraft.value.disabilityType],
      ['preferred age', jobPostingDraft.value.preferredAgeRange],
      ['language', jobPostingDraft.value.language],
      ['qualifications', jobPostingDraft.value.qualifications],
      ['responsibilities', jobPostingDraft.value.responsibilities],
    ]

    const missingFields = requiredFields
      .filter(([, value]) => String(value ?? '').trim() === '')
      .map(([label]) => label)

    if (missingFields.length) {
      showPaymentToast(`Please complete your ${missingFields.join(', ')}.`, 'warning')
      return false
    }

    const vacancyCount = Number(jobPostingDraft.value.vacancies)
    if (!Number.isFinite(vacancyCount) || vacancyCount < 1 || vacancyCount > JOB_POSTING_MAX_VACANCIES) {
      showPaymentToast(`Vacancies must be between 1 and ${JOB_POSTING_MAX_VACANCIES}.`, 'warning')
      return false
    }

    if (!parseJobPostingSalaryRange(jobPostingDraft.value.salaryRange).isValid) {
      showPaymentToast('Enter the salary as minimum - maximum, for example PHP 15,000 - PHP 20,000.', 'warning')
      return false
    }

    const preferredAge = Number(jobPostingDraft.value.preferredAgeRange)
    if (!Number.isFinite(preferredAge) || preferredAge < 18) {
      showPaymentToast('Preferred age must be 18 or above.', 'warning')
      return false
    }

    const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
    const workspaceOwnerEmail = String(
      authUser.value?.workspace_owner_email
      || authUser.value?.workspaceOwnerEmail
      || authUser.value?.business_contact_email
      || authUser.value?.email
      || '',
    ).trim().toLowerCase()
    const employerId = String(authUser.value?.id || authUser.value?.uid || workspaceOwnerId || '').trim()

    if (!workspaceOwnerId || !employerId) {
      showPaymentToast('Refresh the page and sign in again before saving this job post.', 'error')
      return false
    }

    try {
      isSavingJobPost.value = true
      const wasEditingJobPost = isEditingJobPost.value

      const payload = {
        title: jobPostingDraft.value.title,
        companyName: jobPostingCompanyNameDisplay.value,
        logoUrl: businessAvatar.value || profileForm.value.avatar || '',
        description: jobPostingDraft.value.description,
        category: jobPostingCategoryValue.value,
        type: jobPostingDraft.value.type,
        setup: jobPostingDraft.value.type,
        location: jobPostingDraft.value.location,
        barangay: jobPostingDraft.value.barangay,
        vacancies: vacancyCount,
        salary: jobPostingSalaryPreview.value,
        salaryRange: jobPostingDraft.value.salaryRange,
        disabilityType: serializeJobPostingDisabilityTypes(jobPostingDraft.value.disabilityType),
        impairmentSpecification: jobPostingDraft.value.impairmentSpecification,
        preferredAgeRange: String(preferredAge),
        language: jobPostingDraft.value.language,
        languages: jobPostingDraft.value.language,
        qualifications: toJobPostingLineItems(jobPostingDraft.value.qualifications),
        responsibilities: toJobPostingLineItems(jobPostingDraft.value.responsibilities),
        status: String(jobPostingDraft.value.status || 'open').trim().toLowerCase() || 'open',
        workspaceOwnerId,
        workspaceOwnerEmail,
        employerId,
        createdBy: employerId,
      }

      const savedJob = wasEditingJobPost
        ? await updateBusinessJobPost(editingJobPostId.value, payload)
        : await createBusinessJobPost(payload)

      if (savedJob) {
        syncPostedJobRecordLocally(savedJob)
      }

      resetJobPostingDraft()
      jobPostingTab.value = 'posted'
      showPaymentToast(
        wasEditingJobPost
          ? 'Job post updated successfully.'
          : 'Job post published. It now appears in Posted Jobs and the public landing page.',
        'success',
      )
      return true
    } catch (error) {
      showPaymentToast(
        error instanceof Error
          ? error.message
          : isEditingJobPost.value
            ? 'Unable to update the job post right now.'
            : 'Unable to publish the job post right now.',
        'error',
      )
      return false
    } finally {
      isSavingJobPost.value = false
    }
  }
  const setJobPostingDefaultTab = () => {
    jobPostingTab.value = canEditBusinessModule('job-posting') ? 'create' : 'posted'
  }
  const toggleJobPostingTab = () => {
    if (!canEditBusinessModule('job-posting')) {
      jobPostingTab.value = 'posted'
      return
    }

    if (jobPostingTab.value === 'create') {
      jobPostingTab.value = 'posted'
      return
    }

    resetJobPostingDraft()
    jobPostingTab.value = 'create'
  }
  const startWorkspaceJobPostsSync = () => {
    stopWorkspaceJobsSync()

    const workspaceOwnerId = getWorkspaceOwnerDirectoryId()
    if (!workspaceOwnerId) {
      postedJobs.value = []
      isPostedJobsLoading.value = false
      postedJobsSyncMessage.value = ''
      return
    }

    isPostedJobsLoading.value = true
    postedJobsSyncMessage.value = ''
    stopWorkspaceJobsSync = subscribeToWorkspaceJobs(
      workspaceOwnerId,
      (jobs) => {
        postedJobs.value = Array.isArray(jobs)
          ? jobs.map((job) => createPostedJobRecord(job))
          : []
        isPostedJobsLoading.value = false
        postedJobsSyncMessage.value = ''
      },
      (error) => {
        isPostedJobsLoading.value = false
        postedJobsSyncMessage.value = logBusinessStartupSyncIssue(
          'Posted jobs subscription failed during startup.',
          error,
          'The posted jobs list is unavailable right now.',
        )
      },
    )
  }
  const setJobPostingDisabilityTypes = (values = []) => {
    handleJobPostingFieldChange('disabilityType', values)
  }

  return {
    jobPostingTab,
    jobPostingDraft,
    jobPostingTypeDropdownRef,
    jobPostingBarangayDropdownRef,
    jobPostingDisabilityDropdownRef,
    jobPostingLanguageDropdownRef,
    openJobPostActionMenuId,
    jobPostPendingAction,
    jobPostingCompanyNameDisplay,
    jobPostingCategoryValue,
    jobPostingCategoryLabel,
    jobPostingPreviewStatusLabel,
    jobPostingCreatedPreview,
    jobPostingQualificationsPreview,
    jobPostingResponsibilitiesPreview,
    jobPostingSelectedDisabilityTypes,
    jobPostingDisabilityTypeNeedsSpecification,
    jobPostingTypeLabel,
    jobPostingBarangayLabel,
    jobPostingDisabilityLabel,
    jobPostingLanguageLabel,
    jobPostingSalaryPreview,
    isSavingJobPost,
    isPostedJobsLoading,
    postedJobsSyncMessage,
    postedJobs,
    postedJobsSummary,
    jobPostHighlights,
    isEditingJobPost,
    isBusinessApplicationLinkedToPostedJob,
    getJobPostingImpairmentSpecificationPlaceholder,
    toggleJobPostingDropdown,
    closeJobPostingDropdown,
    closeJobPostingDropdownOnOutsideClick,
    isJobPostingDropdownOpen,
    selectJobPostingDropdownValue,
    resolvePostedJobStatusClass,
    setJobPostingDefaultTab,
    toggleJobPostingTab,
    startWorkspaceJobPostsSync,
    stopWorkspaceJobsSync: () => stopWorkspaceJobsSync(),
    handleJobPostingFieldChange,
    saveJobPost,
    cancelJobPostEditing,
    toggleJobPostActionMenu,
    startEditingJobPost,
    updateJobPostStatus,
    isJobPostActionPending,
    permanentlyDeleteJobPost,
    buildJobPostingDisabilityFitLabel,
    setJobPostingDisabilityTypes,
  }
}

export const createRecruitmentBindings = (ctx) => computed(() => ({
  jobPostingTab: ctx.jobPostingTab.value,
  isEditingJobPost: ctx.isEditingJobPost.value,
  postedJobs: ctx.postedJobs.value,
  activeSubscriptionPlan: ctx.activeSubscriptionPlan.value,
  canEditBusinessModule: ctx.canEditBusinessModule,
  toggleJobPostingTab: ctx.toggleJobPostingTab,
  saveJobPost: ctx.saveJobPost,
  jobPostingDraft: ctx.jobPostingDraft.value,
  jobPostingCompanyNameDisplay: ctx.jobPostingCompanyNameDisplay.value,
  jobPostingCategoryLabel: ctx.jobPostingCategoryLabel.value,
  jobPostingTypeLabel: ctx.jobPostingTypeLabel.value,
  isJobPostingDropdownOpen: ctx.isJobPostingDropdownOpen,
  toggleJobPostingDropdown: ctx.toggleJobPostingDropdown,
  selectJobPostingDropdownValue: ctx.selectJobPostingDropdownValue,
  JOB_POSTING_EMPLOYMENT_TYPES: ctx.JOB_POSTING_EMPLOYMENT_TYPES,
  JOB_POSTING_BARANGAYS: ctx.JOB_POSTING_BARANGAYS,
  jobPostingBarangayLabel: ctx.jobPostingBarangayLabel.value,
  JOB_POSTING_MAX_VACANCIES: ctx.JOB_POSTING_MAX_VACANCIES,
  JOB_POSTING_DISABILITY_TYPES: ctx.JOB_POSTING_DISABILITY_TYPES,
  jobPostingDisabilityLabel: ctx.jobPostingDisabilityLabel.value,
  jobPostingSelectedDisabilityTypes: ctx.jobPostingSelectedDisabilityTypes.value,
  jobPostingDisabilityTypeNeedsSpecification: ctx.jobPostingDisabilityTypeNeedsSpecification.value,
  setJobPostingDisabilityTypes: ctx.setJobPostingDisabilityTypes,
  getJobPostingImpairmentSpecificationPlaceholder: ctx.getJobPostingImpairmentSpecificationPlaceholder,
  JOB_POSTING_LANGUAGE_OPTIONS: ctx.JOB_POSTING_LANGUAGE_OPTIONS,
  jobPostingLanguageLabel: ctx.jobPostingLanguageLabel.value,
  handleJobPostingFieldChange: ctx.handleJobPostingFieldChange,
  isSavingJobPost: ctx.isSavingJobPost.value,
  cancelJobPostEditing: ctx.cancelJobPostEditing,
  jobPostingPreviewStatusLabel: ctx.jobPostingPreviewStatusLabel.value,
  jobPostingCreatedPreview: ctx.jobPostingCreatedPreview,
  profileForm: ctx.profileForm.value,
  businessAvatar: ctx.businessAvatar.value,
  businessInitials: ctx.businessInitials.value,
  jobPostingQualificationsPreview: ctx.jobPostingQualificationsPreview.value,
  jobPostingResponsibilitiesPreview: ctx.jobPostingResponsibilitiesPreview.value,
  jobPostingSalaryPreview: ctx.jobPostingSalaryPreview.value,
  buildJobPostingDisabilityFitLabel: ctx.buildJobPostingDisabilityFitLabel,
  jobPostHighlights: ctx.jobPostHighlights.value,
  isPremiumGuideTarget: ctx.isPremiumGuideTarget,
  setJobPostUnlimitedHighlightRef: ctx.setJobPostUnlimitedHighlightRef,
  isPostedJobsLoading: ctx.isPostedJobsLoading.value,
  postedJobsSyncMessage: ctx.postedJobsSyncMessage.value,
  resolvePostedJobStatusClass: ctx.resolvePostedJobStatusClass,
  jobPostPendingAction: ctx.jobPostPendingAction.value,
  openJobPostActionMenuId: ctx.openJobPostActionMenuId.value,
  toggleJobPostActionMenu: ctx.toggleJobPostActionMenu,
  startEditingJobPost: ctx.startEditingJobPost,
  updateJobPostStatus: ctx.updateJobPostStatus,
  isJobPostActionPending: ctx.isJobPostActionPending,
  permanentlyDeleteJobPost: ctx.permanentlyDeleteJobPost,
  setJobPostingTypeDropdownElement: ctx.setJobPostingTypeDropdownElement,
  setJobPostingBarangayDropdownElement: ctx.setJobPostingBarangayDropdownElement,
  setJobPostingDisabilityDropdownElement: ctx.setJobPostingDisabilityDropdownElement,
  setJobPostingLanguageDropdownElement: ctx.setJobPostingLanguageDropdownElement,
}))
