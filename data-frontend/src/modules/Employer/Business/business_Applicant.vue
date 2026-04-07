<script setup>
import { toRefs } from 'vue'
const props = defineProps([
  'businessApplicantHighlights',
  'applicantManagementFilters',
  'applicantManagementRoleOptions',
  'reviewApplicantManagementQueue',
  'applicantManagementSummary',
  'filteredApplicantManagementRows',
  'openApplicantManagementDecision',
  'requestApproveApplicantManagementApplication',
])
const {
  businessApplicantHighlights,
  applicantManagementFilters,
  applicantManagementRoleOptions,
  reviewApplicantManagementQueue,
  applicantManagementSummary,
  filteredApplicantManagementRows,
  openApplicantManagementDecision,
  requestApproveApplicantManagementApplication,
} = toRefs(props)

const isApplicantRowClickable = (applicant) => Boolean(applicant?.id)

const openApplicantRowDetails = (applicant) => {
  if (!isApplicantRowClickable(applicant)) return
  openApplicantManagementDecision.value(applicant.id, 'view')
}

const handleApplicantRowKeydown = (event, applicant) => {
  if (!isApplicantRowClickable(applicant)) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openApplicantRowDetails(applicant)
  }
}
</script>

<template>
<section class="business-applicants">
              <div class="business-applicants__lead">
                <div class="business-applicants__copy">
                  <p class="business-applicants__eyebrow">Recruitment Pipeline</p>
                  <h2>Manage applicants and keep your shortlist organized</h2>
                  <p>
                    See incoming applicants, highlight strong matches, and track who is ready for the
                    next hiring step without leaving the business dashboard.
                  </p>
                </div>
                <div class="business-applicants__lead-meta">
                  <span class="business-applicants__panel-chip">{{ businessApplicantHighlights[0]?.value || '0' }} active applicants</span>
                  <span class="business-applicants__panel-chip">{{ businessApplicantHighlights[2]?.value || '0' }} ready to review</span>
                </div>
              </div>

              <article class="business-applicants__panel business-applicants__panel--main">
                <div class="business-applicants__panel-head">
      
            
                </div>

                <div class="business-user-overview__toolbar business-user-overview__toolbar--applicants">
                  <label class="business-user-overview__field business-user-overview__field--search">
                    <span>Search</span>
                    <input
                      v-model.trim="applicantManagementFilters.search"
                      type="text"
                      placeholder="Search by name, email, or applied role..."
                    />
                  </label>

                  <label class="business-user-overview__field">
                    <span>Role</span>
                    <select v-model="applicantManagementFilters.roleFilter">
                      <option v-for="option in applicantManagementRoleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <label class="business-user-overview__field">
                    <span>Status</span>
                    <select v-model="applicantManagementFilters.statusFilter">
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="under review">Under Review</option>
                      <option value="interview">Interview</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    class="business-user-overview__action-btn business-user-overview__action-btn--primary business-applicants__table-action"
                    @click="reviewApplicantManagementQueue"
                  >
                    <i class="bi bi-list-check" aria-hidden="true" />
                    Review Applicants
                  </button>

                  <div class="business-user-overview__summary">
                    {{ applicantManagementSummary }}
                  </div>
                </div>

                <div class="business-applicants__table-shell">
                  <table class="business-applicants__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Applicant</th>
                        <th>Applied Role</th>
                        <th>Status</th>
                        <th>Applied Date</th>
                        <th class="business-applicants__table-actions-head">Actions</th>
                      </tr>
                    </thead>

                    <TransitionGroup v-if="filteredApplicantManagementRows.length" tag="tbody" name="business-user-overview-row">
                      <tr
                        v-for="(applicant, index) in filteredApplicantManagementRows"
                        :key="`${applicant.id}-${applicant.email}-${index}`"
                        class="business-applicants__table-row"
                        :class="{ 'is-clickable': isApplicantRowClickable(applicant) }"
                        :tabindex="isApplicantRowClickable(applicant) ? 0 : undefined"
                        @click="openApplicantRowDetails(applicant)"
                        @keydown="handleApplicantRowKeydown($event, applicant)"
                      >
                        <td class="business-applicants__table-index">{{ index + 1 }}</td>
                        <td>
                          <div class="business-user-overview__account">
                            <div class="business-user-overview__avatar" :class="applicant.avatarClass">
                              <img
                                v-if="applicant.avatarUrl"
                                :src="applicant.avatarUrl"
                                :alt="`${applicant.name} avatar`"
                                class="business-user-overview__avatar-image"
                                loading="lazy"
                                decoding="async"
                              >
                              <template v-else>{{ applicant.initials }}</template>
                            </div>

                            <div class="business-user-overview__meta">
                              <strong>{{ applicant.name }}</strong>
                              <span>{{ applicant.email }}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="business-applicants__role-copy">
                            <strong>{{ applicant.role }}</strong>
                            <span :title="applicant.accessSummary">{{ applicant.accessSummary }}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            class="business-applicants__status-pill"
                            :class="`is-${applicant.status.replace(/\s+/g, '-')}`"
                          >
                            {{ applicant.statusLabel }}
                          </span>
                        </td>
                        <td>{{ applicant.date }}</td>
                        <td class="business-applicants__table-actions-cell">
                          <div class="business-applicants__row-actions">
                            <button
                              type="button"
                              class="business-applicants__row-action"
                              title="View"
                              aria-label="View"
                              @click.stop="openApplicantManagementDecision(applicant.id, 'view')"
                            >
                              <i class="bi bi-eye" aria-hidden="true" />
                            </button>
                            <button
                              v-if="!applicant.isFinalStatus"
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--approve"
                              title="Approve"
                              aria-label="Approve"
                              @click.stop="requestApproveApplicantManagementApplication(applicant.id)"
                            >
                              <i class="bi bi-check-lg" aria-hidden="true" />
                            </button>
                            <button
                              v-if="!applicant.isFinalStatus"
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--reject"
                              title="Reject"
                              aria-label="Reject"
                              @click.stop="openApplicantManagementDecision(applicant.id, 'reject')"
                            >
                              <i class="bi bi-x-lg" aria-hidden="true" />
                            </button>
                            <button
                              v-else
                              type="button"
                              class="business-applicants__row-action business-applicants__row-action--final"
                              :class="`is-${applicant.finalAction.tone}`"
                              :title="applicant.finalAction.label"
                              :aria-label="applicant.finalAction.label"
                              @click.stop="openApplicantManagementDecision(applicant.id, 'view')"
                            >
                              <i :class="applicant.finalAction.icon" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </TransitionGroup>

                    <tbody v-else>
                      <tr>
                        <td colspan="6">
                          <div class="business-user-overview__empty">
                            No applicants match the current filter.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
</template>
