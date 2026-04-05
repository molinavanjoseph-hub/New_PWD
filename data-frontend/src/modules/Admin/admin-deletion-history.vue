<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { computed, ref } from 'vue'
import AdminSimpleModal from '@/modules/Admin/admin-simple-modal.vue'
import {
  deleteDeletedUserHistoryRecord,
  restoreDeletedUserHistoryRecord,
  updateDeletedUserArchiveState,
} from '@/lib/auth'

const ADMIN_SEEN_APPLICANT_IDS_STORAGE_KEY = 'adminSeenApplicantIds'

const props = defineProps({
  records: {
    type: Array,
    default: () => [],
  },
})

const actionNotice = ref(null)
const activeActionId = ref('')
const activeActionType = ref('')
const selectMode = ref(false)
const selectedRecordIds = ref([])
const isDeleteConfirmOpen = ref(false)

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const setActionNotice = (kind, message) => {
  actionNotice.value = { kind, message }

  if (typeof window !== 'undefined') {
    window.clearTimeout(setActionNotice.timerId)
    setActionNotice.timerId = window.setTimeout(() => {
      actionNotice.value = null
    }, 2600)
  }
}

setActionNotice.timerId = 0

const filteredRecords = computed(() => {
  return (Array.isArray(props.records) ? props.records : [])
    .filter((record) => record?.archived !== true)
})

const allFilteredRecordIds = computed(() =>
  filteredRecords.value
    .map((record) => String(record?.id || '').trim())
    .filter(Boolean),
)

const allRecordsSelected = computed(() =>
  allFilteredRecordIds.value.length > 0
  && allFilteredRecordIds.value.every((id) => selectedRecordIds.value.includes(id)),
)

const isBusy = (recordId, actionType) =>
  activeActionId.value === recordId && activeActionType.value === actionType

const recordInitials = (record) =>
  String(record?.name || 'DU')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    || 'DU'

const recordAvatarClass = (record) => {
  const normalizedRole = String(record?.role || '').trim().toLowerCase()
  return normalizedRole.includes('applicant')
    ? 'deleted-history-table__avatar--applicant'
    : 'deleted-history-table__avatar--employer'
}

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedRecordIds.value = []
  }
}

const toggleRecordSelection = (record) => {
  const recordId = String(record?.id || '').trim()
  if (!recordId) return

  selectedRecordIds.value = selectedRecordIds.value.includes(recordId)
    ? selectedRecordIds.value.filter((id) => id !== recordId)
    : [...selectedRecordIds.value, recordId]
}

const toggleSelectAllRecords = () => {
  selectedRecordIds.value = allRecordsSelected.value ? [] : [...allFilteredRecordIds.value]
}

const markRestoredApplicantAsSeen = (record) => {
  if (typeof window === 'undefined') return
  if (String(record?.role || '').trim().toLowerCase() !== 'applicant') return

  const recordId = String(record?.id || '').trim()
  if (!recordId) return

  try {
    const raw = window.localStorage.getItem(ADMIN_SEEN_APPLICANT_IDS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const nextIds = Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()).filter(Boolean) : []
    const seenIds = new Set([...nextIds, recordId])
    window.localStorage.setItem(ADMIN_SEEN_APPLICANT_IDS_STORAGE_KEY, JSON.stringify([...seenIds]))
  } catch {
    // Ignore local storage issues and allow restore to succeed.
  }
}

const handleArchiveToggle = async (record) => {
  if (selectMode.value) return
  const recordId = String(record?.id || '').trim()
  if (!recordId) return

  activeActionId.value = recordId
  activeActionType.value = 'archive'

  try {
    const nextArchived = record?.archived !== true
    await updateDeletedUserArchiveState(recordId, nextArchived)
    setActionNotice('success', nextArchived ? 'User moved to archived history.' : 'User moved back to active history.')
  } catch (error) {
    setActionNotice('error', error instanceof Error ? error.message : 'Unable to update the archive state right now.')
  } finally {
    activeActionId.value = ''
    activeActionType.value = ''
  }
}

const handleRestore = async (record) => {
  if (selectMode.value) return
  const recordId = String(record?.id || '').trim()
  if (!recordId || String(record?.status || '').trim().toLowerCase() === 'restored') return

  activeActionId.value = recordId
  activeActionType.value = 'restore'

  try {
    await restoreDeletedUserHistoryRecord(recordId)
    markRestoredApplicantAsSeen(record)
    setActionNotice('success', `${record?.name || 'User'} has been restored.`)
  } catch (error) {
    setActionNotice('error', error instanceof Error ? error.message : 'Unable to restore this deleted user right now.')
  } finally {
    activeActionId.value = ''
    activeActionType.value = ''
  }
}

const openBulkDeleteConfirm = () => {
  if (!selectedRecordIds.value.length) {
    setActionNotice('error', 'Select at least one deleted history record to delete.')
    return
  }

  isDeleteConfirmOpen.value = true
}

const closeBulkDeleteConfirm = () => {
  if (activeActionId.value === 'bulk-delete' && activeActionType.value === 'delete') return
  isDeleteConfirmOpen.value = false
}

const handleBulkHistoryDelete = async () => {
  const recordIds = [...new Set(selectedRecordIds.value.filter(Boolean))]
  if (!recordIds.length) {
    setActionNotice('error', 'Select at least one deleted history record to delete.')
    return
  }

  activeActionId.value = 'bulk-delete'
  activeActionType.value = 'delete'

  try {
    for (const recordId of recordIds) {
      await deleteDeletedUserHistoryRecord(recordId)
    }

    isDeleteConfirmOpen.value = false
    selectedRecordIds.value = []
    selectMode.value = false
    setActionNotice('success', `${recordIds.length} deleted history record${recordIds.length === 1 ? '' : 's'} removed.`)
  } catch (error) {
    setActionNotice('error', error instanceof Error ? error.message : 'Unable to delete the selected history records right now.')
  } finally {
    activeActionId.value = ''
    activeActionType.value = ''
  }
}
</script>

<template>
  <section class="deleted-history">
    <article class="deleted-history-toolbar-card">
      <div class="deleted-history-toolbar">
        <div class="deleted-history-toolbar__actions">
          <button type="button" class="deleted-history-toolbar__ghost-btn" @click="toggleSelectMode">
            <i class="bi bi-check2-square" aria-hidden="true" />
            {{ selectMode ? 'Cancel Select' : 'Select' }}
          </button>
          <button type="button" class="deleted-history-toolbar__ghost-btn">
            <i class="bi bi-clock-history" aria-hidden="true" />
            Active Records
          </button>
          <button
            v-if="selectMode"
            type="button"
            class="deleted-history-toolbar__danger-btn"
            :disabled="activeActionId === 'bulk-delete' || activeActionType === 'delete' || !selectedRecordIds.length"
            @click="openBulkDeleteConfirm"
          >
            <i class="bi bi-trash3" aria-hidden="true" />
            <span>
              {{
                activeActionId === 'bulk-delete' && activeActionType === 'delete'
                  ? 'Deleting...'
                  : `Delete Selected${selectedRecordIds.length ? ` (${selectedRecordIds.length})` : ''}`
              }}
            </span>
          </button>
        </div>
      </div>

      <Transition name="history-toast">
        <div
          v-if="actionNotice"
          class="deleted-history-notice"
          :class="`is-${actionNotice.kind}`"
          role="status"
          aria-live="polite"
        >
          <div class="deleted-history-notice__icon" :class="`is-${actionNotice.kind}`" aria-hidden="true">
            <i :class="actionNotice.kind === 'error' ? 'bi bi-x-circle-fill' : 'bi bi-check-circle-fill'" />
          </div>
          <div class="deleted-history-notice__copy">
            <strong>{{ actionNotice.kind === 'error' ? 'Action failed' : 'Success' }}</strong>
            <span>{{ actionNotice.message }}</span>
          </div>
          <button
            type="button"
            class="deleted-history-notice__close"
            aria-label="Close notification"
            @click="actionNotice = null"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </article>

    <div class="deleted-history-table-shell">
      <table class="deleted-history-table">
        <thead>
          <tr>
            <th v-if="selectMode" class="deleted-history-table__select-head">
              <input
                type="checkbox"
                :checked="allRecordsSelected"
                :aria-label="allRecordsSelected ? 'Deselect all records' : 'Select all records'"
                @change="toggleSelectAllRecords"
              >
            </th>
            <th>#</th>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Auth State</th>
            <th>Deleted Date</th>
            <th class="deleted-history-table__actions-head">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(record, index) in filteredRecords"
            :key="record.id || `${record.email}-${index}`"
          >
            <td v-if="selectMode" class="deleted-history-table__select-cell" @click.stop>
              <input
                type="checkbox"
                :checked="selectedRecordIds.includes(String(record?.id || '').trim())"
                aria-label="Select deleted history record"
                @change="toggleRecordSelection(record)"
              >
            </td>
            <td>{{ index + 1 }}</td>
            <td>
              <div class="deleted-history-table__name">
                <span
                  class="deleted-history-table__avatar"
                  :class="recordAvatarClass(record)"
                  aria-hidden="true"
                >
                  {{ recordInitials(record) }}
                </span>
                <span class="deleted-history-table__identity">
                  <strong>{{ record.name || 'Deleted user' }}</strong>
                  <span>{{ record.email || 'No email' }}</span>
                </span>
              </div>
            </td>
            <td>{{ record.role || 'User' }}</td>
            <td>
              <span
                class="deleted-history-status-pill"
                :class="record.status === 'restored' ? 'is-restored' : 'is-deleted'"
              >
                {{ record.status || 'deleted' }}
              </span>
            </td>
            <td>{{ record.auth_state || 'Not set' }}</td>
            <td>{{ formatDate(record.deleted_at) }}</td>
            <td class="deleted-history-table__actions-cell">
              <div class="deleted-history-actions">
                <button
                  type="button"
                  class="deleted-history-action-btn deleted-history-action-btn--restore"
                  title="Restore"
                  aria-label="Restore"
                  :disabled="selectMode || isBusy(record.id, 'restore') || record.status === 'restored'"
                  @click.stop="handleRestore(record)"
                >
                  <span v-if="isBusy(record.id, 'restore')" class="spinner-border spinner-border-sm" aria-hidden="true" />
                  <i v-else class="bi bi-arrow-counterclockwise" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="deleted-history-action-btn"
                  :class="record.archived ? 'deleted-history-action-btn--archive' : 'deleted-history-action-btn--neutral'"
                  :title="record.archived ? 'Unarchive' : 'Archive'"
                  :aria-label="record.archived ? 'Unarchive' : 'Archive'"
                  :disabled="selectMode || isBusy(record.id, 'archive')"
                  @click.stop="handleArchiveToggle(record)"
                >
                  <span v-if="isBusy(record.id, 'archive')" class="spinner-border spinner-border-sm" aria-hidden="true" />
                  <i v-else :class="record.archived ? 'bi bi-box-arrow-up' : 'bi bi-archive'" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredRecords.length">
            <td :colspan="selectMode ? 8 : 7">
              <div class="deleted-history-empty">No deleted user history found.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminSimpleModal
      :open="isDeleteConfirmOpen"
      :show-close-button="false"
      title="Delete Selected History"
      subtitle="This will permanently remove the selected deletion history records."
      max-width="32rem"
      @close="closeBulkDeleteConfirm"
    >
      <div class="deleted-history-modal__panel">
        <p class="deleted-history-modal__copy">
          Are you sure you want to delete {{ selectedRecordIds.length }} selected history record{{ selectedRecordIds.length === 1 ? '' : 's' }}?
        </p>
        <p class="deleted-history-modal__warning">
          This action cannot be undone.
        </p>
      </div>

      <template #actions>
        <button
          type="button"
          class="deleted-history-modal__button deleted-history-modal__button--ghost"
          :disabled="activeActionId === 'bulk-delete' && activeActionType === 'delete'"
          @click="closeBulkDeleteConfirm"
        >
          Cancel
        </button>
        <button
          type="button"
          class="deleted-history-modal__button deleted-history-modal__button--danger"
          :disabled="activeActionId === 'bulk-delete' && activeActionType === 'delete'"
          @click="handleBulkHistoryDelete"
        >
          <span
            v-if="activeActionId === 'bulk-delete' && activeActionType === 'delete'"
            class="deleted-history-modal__spinner"
            aria-hidden="true"
          />
          <span v-if="activeActionId !== 'bulk-delete' || activeActionType !== 'delete'">Yes, Delete Selected</span>
        </button>
      </template>
    </AdminSimpleModal>

  </section>
</template>

<style scoped>
.deleted-history {
  display: grid;
  gap: 0.95rem;
  font-family: "Inter", "Segoe UI", sans-serif;
}


.deleted-history-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px auto;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.deleted-history-filter {
  display: grid;
  gap: 0.38rem;
}

.deleted-history-filter span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.deleted-history-filter input,
.deleted-history-filter select {
  min-height: 2.65rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.55rem;
  padding: 0 0.9rem;
  outline: none;
  background: #fff;
  color: #274234;
  font: inherit;
}

.deleted-history-filter input:focus,
.deleted-history-filter select:focus {
  border-color: rgba(55, 151, 102, 0.34);
  box-shadow: 0 0 0 4px rgba(55, 151, 102, 0.08);
}

.deleted-history-toolbar__actions {
  display: flex;
  align-items: end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.deleted-history-toolbar__ghost-btn,
.deleted-history-toolbar__danger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.45rem;
  border-radius: 0.82rem;
  padding: 0.55rem 1rem;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.deleted-history-toolbar__ghost-btn {
  border-color: #d7dfd9;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
}

.deleted-history-toolbar__danger-btn {
  border-color: rgba(220, 38, 38, 0.18);
  background: linear-gradient(180deg, #fff8f8 0%, #fff0f0 100%);
  color: #b42318;
}

.deleted-history-toolbar__ghost-btn:hover,
.deleted-history-toolbar__danger-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

.deleted-history-toolbar__danger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.deleted-history-modal__panel {
  display: grid;
  gap: 0.55rem;
}

.deleted-history-modal__copy,
.deleted-history-modal__warning {
  margin: 0;
  color: #35503f;
  font-size: 0.94rem;
  line-height: 1.6;
}

.deleted-history-modal__warning {
  color: #9f1239;
}

.deleted-history-modal__button {
  min-height: 2.6rem;
  border-radius: 0.7rem;
  padding: 0 1rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.deleted-history-modal__button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.deleted-history-modal__button--ghost {
  border-color: rgba(122, 179, 145, 0.18);
  background: #fff;
  color: #476857;
}

.deleted-history-modal__button--danger {
  border-color: rgba(220, 38, 38, 0.18);
  background: #b42318;
  color: #fff;
}

.deleted-history-modal__spinner {
  width: 1rem;
  height: 1rem;
  display: inline-block;
  margin-right: 0.1rem;
  border: 2px solid rgba(255, 255, 255, 0.38);
  border-top-color: #ffffff;
  border-radius: 999px;
  animation: deleted-history-modal-spin 0.72s linear infinite;
}

@keyframes deleted-history-modal-spin {
  to {
    transform: rotate(360deg);
  }
}

.deleted-history-table-shell {
  overflow: hidden;
  border: 1px solid rgba(122, 179, 145, 0.14);
  border-radius: 0.8rem;
  background: #fff;
}

.deleted-history-table {
  width: 100%;
  border-collapse: collapse;
}

.deleted-history-table thead th {
  padding: 0.82rem 0.9rem;
  text-align: left;
  color: #6d8576;
  font-size: 0.76rem;
  font-weight: 700;
  background: #f7fbf8;
}

.deleted-history-table__select-head,
.deleted-history-table__select-cell {
  width: 2.8rem;
}

.deleted-history-table__select-head input,
.deleted-history-table__select-cell input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  border: 1.5px solid rgba(117, 148, 130, 0.7);
  border-radius: 0.32rem;
  background: #ffffff;
  display: inline-grid;
  place-content: center;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.deleted-history-table__select-head input::before,
.deleted-history-table__select-cell input::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  clip-path: polygon(14% 44%, 0 59%, 39% 100%, 100% 21%, 84% 7%, 38% 67%);
  transform: scale(0);
  transform-origin: center;
  transition: transform 0.16s ease;
  background: #ffffff;
}

.deleted-history-table__select-head input:hover,
.deleted-history-table__select-cell input:hover {
  border-color: #2c8a62;
  box-shadow: 0 0 0 4px rgba(44, 138, 98, 0.1);
}

.deleted-history-table__select-head input:checked,
.deleted-history-table__select-cell input:checked {
  border-color: #2c8a62;
  background: linear-gradient(135deg, #2c8a62 0%, #39a071 100%);
}

.deleted-history-table__select-head input:checked::before,
.deleted-history-table__select-cell input:checked::before {
  transform: scale(1);
}

.deleted-history-table tbody td {
  padding: 0.82rem 0.9rem;
  color: #35503f;
  font-size: 0.84rem;
  border-top: 1px solid rgba(122, 179, 145, 0.1);
  vertical-align: middle;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.deleted-history-table tbody tr:hover td {
  background: #f2f4f5;
  border-color: rgba(203, 213, 225, 0.7);
}

.deleted-history-table__name {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.deleted-history-table__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.3rem;
  width: 2.3rem;
  height: 2.3rem;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  border-radius: 0.7rem;
  border: 1px solid rgba(80, 144, 111, 0.2);
  box-shadow: 0 12px 28px rgba(66, 126, 95, 0.16);
}

.deleted-history-table__avatar--applicant {
  background: linear-gradient(135deg, #2f9a67, #6ccb93);
}

.deleted-history-table__avatar--employer {
  background: linear-gradient(135deg, #3a7cf0, #6fa6ff);
  border-color: rgba(73, 118, 209, 0.22);
  box-shadow: 0 12px 28px rgba(59, 112, 219, 0.18);
}

.deleted-history-table__identity {
  display: grid;
  gap: 0.16rem;
  min-width: 0;
}

.deleted-history-table__identity strong {
  color: #1f3a2d;
  font-size: 0.88rem;
  font-weight: 700;
}

.deleted-history-table__identity span {
  color: #7a9383;
  font-size: 0.76rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deleted-history-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6.25rem;
  padding: 0.38rem 0.72rem;
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1;
  text-transform: capitalize;
  background: rgba(249, 115, 22, 0.08);
  color: #d97706;
}

.deleted-history-status-pill.is-deleted {
  background: rgba(223, 115, 134, 0.12);
  border-color: rgba(223, 115, 134, 0.18);
  color: #bf5f72;
}

.deleted-history-status-pill.is-restored {
  border-color: #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
}

.deleted-history-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.28rem;
}

.deleted-history-action-btn {
  width: 2.2rem;
  height: 2.2rem;
  border: 0;
  border-radius: 0.45rem;
  display: grid;
  place-items: center;
  background: transparent;
  color: #8a978f;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.deleted-history-action-btn i {
  font-size: 1rem;
}

.deleted-history-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.deleted-history-action-btn--restore:hover {
  background: rgba(235, 247, 240, 0.98);
  color: #228454;
}

.deleted-history-action-btn--archive:hover {
  background: rgba(235, 247, 240, 0.98);
  color: #228454;
}

.deleted-history-action-btn--neutral:hover {
  background: rgba(241, 245, 249, 0.96);
  color: #2d684d;
}

.deleted-history-table__actions-head,
.deleted-history-table__actions-cell {
  width: 6.5rem;
}

.deleted-history-empty {
  padding: 1.2rem;
  text-align: center;
  color: #6f8578;
}

.deleted-history-notice {
  position: fixed;
  bottom: 2rem;
  left: 1.5rem;
  z-index: 24;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: center;
  width: min(28rem, calc(100% - 1.5rem));
  padding: 0.95rem 1rem;
  border: 1px solid rgba(220, 38, 38, 0.14);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
}

.deleted-history-notice.is-success {
  border-color: rgba(22, 163, 74, 0.16);
}

.deleted-history-notice.is-error {
  border-color: rgba(171, 70, 70, 0.22);
}

.deleted-history-notice__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.96) 0%, rgba(254, 226, 226, 0.78) 100%);
  color: #dc2626;
  box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.18);
  flex: 0 0 2.5rem;
}

.deleted-history-notice__icon.is-success {
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.96) 0%, rgba(220, 252, 231, 0.82) 100%);
  color: #16a34a;
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.24);
}

.deleted-history-notice__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.deleted-history-notice__copy strong {
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 800;
}

.deleted-history-notice__copy span {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.deleted-history-notice__close {
  width: 2rem;
  height: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.history-toast-enter-active,
.history-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.history-toast-enter-from,
.history-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 900px) {
  .deleted-history-toolbar {
    grid-template-columns: 1fr;
  }

  .deleted-history-toolbar__actions {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .deleted-history-notice {
    align-items: flex-start;
    flex-direction: column;
  }

  .deleted-history-table-shell {
    overflow-x: auto;
  }

  .deleted-history-table {
    min-width: 860px;
  }
}

@media (max-width: 768px) {
  .deleted-history-toolbar-card {
    padding: 0.92rem;
  }

  .deleted-history-toolbar__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .deleted-history-notice {
    width: min(calc(100vw - 1.5rem), 32rem);
  }
}

@media (max-width: 640px) {
  .deleted-history-toolbar-card {
    padding: 0.85rem;
  }

  .deleted-history-toolbar {
    gap: 0.68rem;
  }

  .deleted-history-toolbar__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .deleted-history-toolbar__ghost-btn,
  .deleted-history-toolbar__danger-btn {
    width: 100%;
    min-height: 2.55rem;
  }

  .deleted-history-notice {
    width: calc(100vw - 1.4rem);
    left: 0.7rem;
    bottom: 0.7rem;
  }
}
</style>
