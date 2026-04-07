<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  inboxItems: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['open-section'])

const searchQuery = ref('')
const activeFilter = ref('all')
const selectedMessageId = ref('')
const displayedMessageId = ref('')
const readMessageIds = ref([])
const isViewerLoading = ref(false)

const MESSAGE_SWITCH_DELAY_MS = 1000

let messageSwitchToken = 0
let messageSwitchTimeoutId = null

const getSenderInitials = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'IN'

const normalizedItems = computed(() =>
  (Array.isArray(props.inboxItems) ? props.inboxItems : [])
    .map((item) => ({
      id: String(item?.id || '').trim(),
      sender: String(item?.sender || 'Inbox update').trim() || 'Inbox update',
      senderImageUrl: String(item?.senderImageUrl || item?.senderLogoUrl || item?.logoUrl || '').trim(),
      senderMeta: String(item?.senderMeta || '').trim(),
      subject: String(item?.subject || 'Untitled message').trim() || 'Untitled message',
      preview: String(item?.preview || '').trim(),
      timeLabel: String(item?.timeLabel || '').trim() || 'Recently',
      section: String(item?.section || '').trim(),
      sectionLabel: String(item?.sectionLabel || '').trim() || 'Inbox',
      category: String(item?.category || 'Update').trim() || 'Update',
      actionLabel: String(item?.actionLabel || '').trim(),
      tone: String(item?.tone || 'neutral').trim() || 'neutral',
      icon: String(item?.icon || 'bi bi-inbox').trim() || 'bi bi-inbox',
      body: Array.isArray(item?.body)
        ? item.body.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
      meta: Array.isArray(item?.meta)
        ? item.meta
          .map((entry) => ({
            label: String(entry?.label || '').trim(),
            value: String(entry?.value || '').trim(),
          }))
          .filter((entry) => entry.label && entry.value)
        : [],
      isUnread: item?.isUnread === true,
      createdAtValue: Number(item?.createdAtValue || 0) || 0,
    }))
    .filter((item) => item.id)
    .sort((left, right) => right.createdAtValue - left.createdAtValue),
)

const filterItems = computed(() => {
  const unreadCount = normalizedItems.value.filter((item) => item.isUnread && !readMessageIds.value.includes(item.id)).length
  const applicationsCount = normalizedItems.value.filter((item) => item.section === 'applications').length
  const interviewsCount = normalizedItems.value.filter((item) => item.section === 'interviews').length
  const assessmentsCount = normalizedItems.value.filter((item) => item.section === 'technical-assessment').length
  const updatesCount = normalizedItems.value.filter((item) =>
    !['applications', 'interviews', 'technical-assessment'].includes(item.section)).length

  return [
    { id: 'all', label: 'All', count: normalizedItems.value.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'applications', label: 'Applications', count: applicationsCount },
    { id: 'interviews', label: 'Interviews', count: interviewsCount },
    { id: 'technical-assessment', label: 'Assessments', count: assessmentsCount },
    { id: 'updates', label: 'Updates', count: updatesCount },
  ]
})

const filteredItems = computed(() => {
  const normalizedQuery = String(searchQuery.value || '').trim().toLowerCase()

  return normalizedItems.value.filter((item) => {
    const matchesFilter = activeFilter.value === 'all'
      ? true
      : activeFilter.value === 'unread'
        ? item.isUnread && !readMessageIds.value.includes(item.id)
        : activeFilter.value === 'updates'
          ? !['applications', 'interviews', 'technical-assessment'].includes(item.section)
          : item.section === activeFilter.value

    if (!matchesFilter) return false
    if (!normalizedQuery) return true

    return [
      item.sender,
      item.senderMeta,
      item.subject,
      item.preview,
      item.category,
      item.sectionLabel,
      ...item.body,
      ...item.meta.map((entry) => `${entry.label} ${entry.value}`),
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
  })
})

const unreadCount = computed(() =>
  normalizedItems.value.filter((item) => item.isUnread && !readMessageIds.value.includes(item.id)).length,
)

const activeMessage = computed(() =>
  filteredItems.value.find((item) => item.id === selectedMessageId.value) || filteredItems.value[0] || null,
)

const selectedMessage = computed(() =>
  filteredItems.value.find((item) => item.id === displayedMessageId.value) || null,
)

const selectedMessageOverviewCards = computed(() => {
  if (!selectedMessage.value) return []

  const cards = [
    { id: 'mailbox', label: 'Mailbox', value: selectedMessage.value.sectionLabel || 'Inbox' },
    { id: 'category', label: 'Category', value: selectedMessage.value.category || 'Update' },
    { id: 'received', label: 'Received', value: selectedMessage.value.timeLabel || 'Recently' },
  ]

  if (selectedMessage.value.senderMeta) {
    cards.splice(1, 0, {
      id: 'regarding',
      label: 'Regarding',
      value: selectedMessage.value.senderMeta,
    })
  }

  return cards.slice(0, 4)
})

const selectedMessageBody = computed(() => {
  if (!selectedMessage.value) return []

  const preview = String(selectedMessage.value.preview || '').trim()

  if (Array.isArray(selectedMessage.value.body) && selectedMessage.value.body.length) {
    const filteredBody = preview && selectedMessage.value.body.length > 1
      ? selectedMessage.value.body.filter((entry) => String(entry || '').trim() !== preview)
      : selectedMessage.value.body

    return filteredBody.length ? filteredBody : [preview]
  }

  return preview ? [preview] : ['This inbox thread does not have additional message details yet.']
})

const clearMessageSwitchTimeout = () => {
  if (messageSwitchTimeoutId) {
    clearTimeout(messageSwitchTimeoutId)
    messageSwitchTimeoutId = null
  }
}

const selectMessage = (messageId, options = {}) => {
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedMessageId) return

  const immediate = options?.immediate === true
  const isSameSelection = normalizedMessageId === selectedMessageId.value

  selectedMessageId.value = normalizedMessageId

  if (immediate || !displayedMessageId.value || MESSAGE_SWITCH_DELAY_MS <= 0) {
    clearMessageSwitchTimeout()
    isViewerLoading.value = false
    displayedMessageId.value = normalizedMessageId
    return
  }

  if (isSameSelection && displayedMessageId.value === normalizedMessageId && !isViewerLoading.value) {
    return
  }

  clearMessageSwitchTimeout()
  isViewerLoading.value = true

  const currentToken = ++messageSwitchToken
  messageSwitchTimeoutId = setTimeout(() => {
    if (currentToken !== messageSwitchToken) return
    displayedMessageId.value = normalizedMessageId
    isViewerLoading.value = false
    messageSwitchTimeoutId = null
  }, MESSAGE_SWITCH_DELAY_MS)
}

const openMessageSection = (message) => {
  const targetSection = String(message?.section || '').trim()
  if (!targetSection) return
  emit('open-section', targetSection)
}

const isMessageUnread = (message) =>
  Boolean(message?.isUnread) && !readMessageIds.value.includes(String(message?.id || '').trim())

watch(filteredItems, (items) => {
  const normalizedItemsList = Array.isArray(items) ? items : []
  if (!normalizedItemsList.length) {
    clearMessageSwitchTimeout()
    isViewerLoading.value = false
    selectedMessageId.value = ''
    displayedMessageId.value = ''
    return
  }

  if (!normalizedItemsList.some((item) => item.id === selectedMessageId.value)) {
    selectMessage(normalizedItemsList[0]?.id || '', { immediate: true })
    return
  }

  if (!normalizedItemsList.some((item) => item.id === displayedMessageId.value)) {
    displayedMessageId.value = selectedMessageId.value || normalizedItemsList[0]?.id || ''
  }
}, { immediate: true })

watch(selectedMessageId, (messageId) => {
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedMessageId || readMessageIds.value.includes(normalizedMessageId)) return
  readMessageIds.value = [...readMessageIds.value, normalizedMessageId]
}, { immediate: true })

onBeforeUnmount(() => {
  clearMessageSwitchTimeout()
})
</script>

<template>
  <section class="applicant-inbox-page">


    <div class="applicant-inbox-page__shell">
      <aside class="applicant-inbox-page__sidebar">
        <div class="applicant-inbox-page__filters" aria-label="Inbox filters">
          <button
            v-for="filter in filterItems"
            :key="filter.id"
            type="button"
            class="applicant-inbox-page__filter"
            :class="{ 'is-active': activeFilter === filter.id }"
            @click="activeFilter = filter.id"
          >
            <span>{{ filter.label }}</span>
            <strong>{{ filter.count }}</strong>
          </button>
        </div>

        <div v-if="filteredItems.length" class="applicant-inbox-page__thread-list">
          <button
            v-for="item in filteredItems"
            :key="item.id"
            type="button"
            class="applicant-inbox-page__thread"
            :class="[
              `is-${item.tone}`,
              { 'is-active': activeMessage?.id === item.id, 'is-unread': isMessageUnread(item) },
            ]"
            @click="selectMessage(item.id)"
          >
            <span class="applicant-inbox-page__thread-avatar" aria-hidden="true">
              <img
                v-if="item.senderImageUrl"
                :src="item.senderImageUrl"
                alt=""
                class="applicant-inbox-page__avatar-image"
              />
              <template v-else>{{ getSenderInitials(item.sender) }}</template>
            </span>

            <span class="applicant-inbox-page__thread-copy">
              <span class="applicant-inbox-page__thread-topline">
                <strong>{{ item.sender }}</strong>
                <small>{{ item.timeLabel }}</small>
              </span>
              <span class="applicant-inbox-page__thread-subject">{{ item.subject }}</span>
              <span class="applicant-inbox-page__thread-preview">{{ item.preview }}</span>
              <span class="applicant-inbox-page__thread-meta">
                <span class="applicant-inbox-page__thread-tag">
                  <i :class="item.icon" aria-hidden="true" />
                  {{ item.category }}
                </span>
                <span v-if="item.senderMeta">{{ item.senderMeta }}</span>
              </span>
            </span>
          </button>
        </div>

        <div v-else class="applicant-inbox-page__list-empty">
          <i class="bi bi-inbox" aria-hidden="true" />
          <h2>No inbox matches</h2>
          <p>Try a different filter or search query. New employer updates will appear here automatically.</p>
        </div>
      </aside>

      <section class="applicant-inbox-page__viewer">
        <div v-if="isViewerLoading" class="applicant-inbox-page__viewer-loading" aria-live="polite" aria-label="Loading message">
          <span class="applicant-inbox-page__viewer-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

        <article v-else-if="selectedMessage" class="applicant-inbox-page__message">
          <div class="applicant-inbox-page__message-hero">
            <div class="applicant-inbox-page__message-head">
              <div class="applicant-inbox-page__message-labels">
                <span class="applicant-inbox-page__category-pill" :class="`is-${selectedMessage.tone}`">
                  <i :class="selectedMessage.icon" aria-hidden="true" />
                  {{ selectedMessage.category }}
                </span>
                <span class="applicant-inbox-page__section-pill">{{ selectedMessage.sectionLabel }}</span>
              </div>

              <button
                v-if="selectedMessage.actionLabel"
                type="button"
                class="applicant-inbox-page__open-button"
                @click="openMessageSection(selectedMessage)"
              >
                <i class="bi bi-arrow-up-right" aria-hidden="true" />
                {{ selectedMessage.actionLabel }}
              </button>
            </div>

            <header class="applicant-inbox-page__message-header">
              <div class="applicant-inbox-page__message-title-block">
                <h2>{{ selectedMessage.subject }}</h2>
                <p v-if="selectedMessage.preview" class="applicant-inbox-page__message-lead">
                  {{ selectedMessage.preview }}
                </p>
              </div>

              <div class="applicant-inbox-page__message-sender">
                <span class="applicant-inbox-page__message-avatar" aria-hidden="true">
                  <img
                    v-if="selectedMessage.senderImageUrl"
                    :src="selectedMessage.senderImageUrl"
                    alt=""
                    class="applicant-inbox-page__avatar-image"
                  />
                  <template v-else>{{ getSenderInitials(selectedMessage.sender) }}</template>
                </span>

                <div class="applicant-inbox-page__message-sender-copy">
                  <strong>{{ selectedMessage.sender }}</strong>
                  <span>{{ selectedMessage.senderMeta || selectedMessage.sectionLabel }}</span>
                </div>

                <time class="applicant-inbox-page__message-time">{{ selectedMessage.timeLabel }}</time>
              </div>
            </header>

            <div v-if="selectedMessageOverviewCards.length" class="applicant-inbox-page__message-overview">
              <div
                v-for="card in selectedMessageOverviewCards"
                :key="`${selectedMessage.id}-${card.id}`"
                class="applicant-inbox-page__message-overview-item"
              >
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
              </div>
            </div>
          </div>

          <div class="applicant-inbox-page__message-content">
            <div class="applicant-inbox-page__message-copy">
              <div class="applicant-inbox-page__message-copy-head">
                <span>Message</span>
                <strong>Latest update</strong>
              </div>

              <div class="applicant-inbox-page__message-body">
                <p
                  v-for="(paragraph, index) in selectedMessageBody"
                  :key="`${selectedMessage.id}-body-${index}`"
                  :class="{ 'is-highlight': index === 0 }"
                >
                  {{ paragraph }}
                </p>
              </div>
            </div>


          </div>
        </article>

        <div v-else class="applicant-inbox-page__viewer-empty">
          <i class="bi bi-envelope-open" aria-hidden="true" />
          <h2>Select a message</h2>
          <p>Choose a thread from the inbox list to read the full update here.</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.applicant-inbox-page {
  display: grid;
  gap: 1.5rem;
  min-height: 0;
  height: calc(100vh - var(--applicant-sticky-navbar-offset) - 1rem);
  height: calc(100dvh - var(--applicant-sticky-navbar-offset) - 1rem);
  max-height: calc(100vh - var(--applicant-sticky-navbar-offset) - 1rem);
  max-height: calc(100dvh - var(--applicant-sticky-navbar-offset) - 1rem);
  overflow: hidden;
}

.applicant-inbox-page__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem 1.75rem;
  border: 1px solid rgba(66, 112, 87, 0.18);
  background:
    radial-gradient(circle at top left, rgba(214, 241, 227, 0.85), transparent 42%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 249, 0.98));
  box-shadow: 0 18px 40px rgba(31, 74, 51, 0.08);
}

.applicant-inbox-page__hero-copy {
  display: grid;
  gap: 0.55rem;
  max-width: 40rem;
}

.applicant-inbox-page__eyebrow {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #577564;
}

.applicant-inbox-page__hero-copy h1 {
  margin: 0;
  font-size: clamp(1.8rem, 2vw, 2.2rem);
  line-height: 1.05;
  color: #183927;
}

.applicant-inbox-page__hero-copy p {
  margin: 0;
  max-width: 34rem;
  font-size: 0.98rem;
  line-height: 1.65;
  color: #557061;
}

.applicant-inbox-page__hero-tools {
  display: grid;
  gap: 0.9rem;
  min-width: min(100%, 19rem);
}

.applicant-inbox-page__search {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(83, 128, 98, 0.24);
  background: rgba(255, 255, 255, 0.9);
}

.applicant-inbox-page__search i {
  font-size: 1rem;
  color: #45765a;
}

.applicant-inbox-page__search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 0.95rem;
  color: #234532;
}

.applicant-inbox-page__search input::placeholder {
  color: #7b9587;
}

.applicant-inbox-page__stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(83, 128, 98, 0.2);
  background: rgba(241, 248, 244, 0.92);
  color: #234532;
}

.applicant-inbox-page__stat strong {
  font-size: 1.5rem;
  line-height: 1;
}

.applicant-inbox-page__stat span {
  font-size: 0.88rem;
  color: #5e7a69;
}

.applicant-inbox-page__shell {
  display: grid;
  grid-template-columns: minmax(18rem, 26rem) minmax(0, 1fr);
  gap: 1.25rem;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.applicant-inbox-page__sidebar,
.applicant-inbox-page__viewer {
  min-height: 0;
  border: 1px solid rgba(66, 112, 87, 0.18);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 36px rgba(31, 74, 51, 0.07);
}

.applicant-inbox-page__sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.applicant-inbox-page__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(83, 128, 98, 0.14);
  background: linear-gradient(180deg, rgba(247, 252, 249, 0.95), rgba(255, 255, 255, 0.95));
}

.applicant-inbox-page__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.62rem 0.8rem;
  border: 1px solid rgba(83, 128, 98, 0.18);
  background: #fff;
  color: #355745;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.applicant-inbox-page__filter strong {
  font-size: 0.84rem;
}

.applicant-inbox-page__filter.is-active {
  border-color: rgba(31, 122, 82, 0.4);
  background: rgba(224, 243, 232, 0.94);
  color: #18412c;
}

.applicant-inbox-page__filter:hover {
  transform: translateY(-1px);
}

.applicant-inbox-page__thread-list {
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: 0;
  overflow-y: auto;
}

.applicant-inbox-page__thread {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: flex-start;
  align-content: start;
  padding: 1rem;
  border: 0;
  border-bottom: 1px solid rgba(83, 128, 98, 0.12);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.applicant-inbox-page__thread:hover {
  background: rgba(242, 248, 245, 0.92);
}

.applicant-inbox-page__thread.is-active {
  background:
    linear-gradient(90deg, rgba(216, 242, 226, 0.92), rgba(255, 255, 255, 0.98));
  box-shadow: inset 4px 0 0 #2d9360;
}

.applicant-inbox-page__thread.is-unread .applicant-inbox-page__thread-subject,
.applicant-inbox-page__thread.is-unread .applicant-inbox-page__thread-topline strong {
  font-weight: 800;
}

.applicant-inbox-page__thread-avatar,
.applicant-inbox-page__message-avatar {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  aspect-ratio: 1;
  border: 1px solid rgba(83, 128, 98, 0.18);
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(225, 243, 233, 0.95), rgba(247, 252, 249, 0.96));
  color: #1c5138;
  font-size: 0.86rem;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.applicant-inbox-page__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.applicant-inbox-page__thread-copy {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.applicant-inbox-page__thread-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.applicant-inbox-page__thread-topline strong,
.applicant-inbox-page__thread-topline small,
.applicant-inbox-page__thread-subject,
.applicant-inbox-page__thread-preview,
.applicant-inbox-page__thread-meta,
.applicant-inbox-page__message-lead,
.applicant-inbox-page__message-sender-copy span,
.applicant-inbox-page__message-time,
.applicant-inbox-page__message-body p,
.applicant-inbox-page__message-overview-item span,
.applicant-inbox-page__message-overview-item strong,
.applicant-inbox-page__message-detail span,
.applicant-inbox-page__message-detail strong {
  overflow-wrap: anywhere;
}

.applicant-inbox-page__thread-topline strong {
  color: #193826;
  font-size: 0.95rem;
}

.applicant-inbox-page__thread-topline small {
  color: #6f8a7b;
  font-size: 0.78rem;
  white-space: nowrap;
}

.applicant-inbox-page__thread-subject {
  color: #264937;
  font-size: 0.92rem;
}

.applicant-inbox-page__thread-preview {
  display: -webkit-box;
  color: #6b8577;
  font-size: 0.84rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.applicant-inbox-page__thread-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  color: #62806e;
  font-size: 0.78rem;
}

.applicant-inbox-page__thread-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.24rem 0.5rem;
  border: 1px solid rgba(83, 128, 98, 0.16);
  background: rgba(244, 250, 246, 0.92);
  color: #2a5c42;
}

.applicant-inbox-page__viewer {
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.applicant-inbox-page__message,
.applicant-inbox-page__viewer-loading,
.applicant-inbox-page__viewer-empty {
  width: 100%;
}

.applicant-inbox-page__message {
  display: grid;
  align-content: start;
  gap: 1.15rem;
  padding: 1.2rem 1.25rem 1.35rem;
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(248, 252, 250, 0.96), rgba(255, 255, 255, 0.98) 18rem),
    #fff;
}

.applicant-inbox-page__viewer-loading {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 2rem;
  background:
    radial-gradient(circle at top left, rgba(219, 242, 228, 0.52), transparent 44%),
    linear-gradient(180deg, rgba(248, 252, 250, 0.96), rgba(255, 255, 255, 0.98) 18rem),
    #fff;
}

.applicant-inbox-page__viewer-loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.applicant-inbox-page__viewer-loading-dots span {
  width: 0.8rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: linear-gradient(180deg, #8ca497, #557b66);
  opacity: 0.35;
  animation: applicantInboxViewerDots 1s ease-in-out infinite;
}

.applicant-inbox-page__viewer-loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.applicant-inbox-page__viewer-loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.applicant-inbox-page__message-hero {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem 1.1rem;
  border: 1px solid rgba(83, 128, 98, 0.14);
  background:
    radial-gradient(circle at top left, rgba(219, 242, 228, 0.72), transparent 46%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 249, 0.98));
}

.applicant-inbox-page__message-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.applicant-inbox-page__message-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.applicant-inbox-page__category-pill,
.applicant-inbox-page__section-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.48rem 0.72rem;
  border: 1px solid rgba(83, 128, 98, 0.18);
  font-size: 0.82rem;
  font-weight: 700;
}

.applicant-inbox-page__category-pill.is-success {
  background: rgba(221, 245, 231, 0.95);
  color: #176742;
}

.applicant-inbox-page__category-pill.is-danger {
  background: rgba(252, 232, 232, 0.94);
  color: #a03636;
}

.applicant-inbox-page__category-pill.is-warning {
  background: rgba(255, 245, 219, 0.96);
  color: #996d00;
}

.applicant-inbox-page__category-pill.is-info,
.applicant-inbox-page__category-pill.is-accent,
.applicant-inbox-page__category-pill.is-neutral,
.applicant-inbox-page__category-pill.is-pending {
  background: rgba(225, 239, 248, 0.95);
  color: #285f86;
}

.applicant-inbox-page__category-pill.is-muted {
  background: rgba(237, 240, 240, 0.96);
  color: #536665;
}

.applicant-inbox-page__section-pill {
  background: rgba(247, 250, 248, 0.96);
  color: #4e6d5b;
}

.applicant-inbox-page__open-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.78rem 1rem;
  border: 1px solid rgba(42, 117, 79, 0.22);
  background: rgba(245, 251, 247, 0.98);
  color: #1d5b3d;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.applicant-inbox-page__message-header {
  display: grid;
  gap: 0.95rem;
}

.applicant-inbox-page__message-title-block {
  display: grid;
  gap: 0.65rem;
}

.applicant-inbox-page__message-header h2 {
  margin: 0;
  color: #173a28;
  font-size: clamp(1.35rem, 1.8vw, 1.8rem);
  line-height: 1.2;
}

.applicant-inbox-page__message-lead {
  margin: 0;
  max-width: 48rem;
  color: #5a7567;
  font-size: 0.95rem;
  line-height: 1.68;
}

.applicant-inbox-page__message-sender {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  padding-top: 0.95rem;
  border-top: 1px solid rgba(83, 128, 98, 0.14);
}

.applicant-inbox-page__message-sender-copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.applicant-inbox-page__message-sender-copy strong {
  color: #173a28;
  font-size: 0.96rem;
}

.applicant-inbox-page__message-sender-copy span,
.applicant-inbox-page__message-time {
  color: #6b8577;
  font-size: 0.85rem;
}

.applicant-inbox-page__message-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.9rem 1.05rem;
  padding-top: 0.15rem;
}

.applicant-inbox-page__message-overview-item {
  display: grid;
  gap: 0.3rem;
  min-height: 3.55rem;
  padding-left: 0.85rem;
  border-left: 3px solid rgba(57, 135, 92, 0.22);
}

.applicant-inbox-page__message-overview-item span {
  color: #6f897b;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-inbox-page__message-overview-item strong {
  color: #173927;
  font-size: 0.95rem;
}

.applicant-inbox-page__message-content {
  display: grid;
  gap: 1.05rem;
}

.applicant-inbox-page__message-copy {
  display: grid;
  gap: 0.95rem;
  padding: 1rem 1.05rem 1.1rem;
  border: 1px solid rgba(83, 128, 98, 0.12);
  background: rgba(255, 255, 255, 0.94);
}

.applicant-inbox-page__message-copy-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(83, 128, 98, 0.12);

}

.applicant-inbox-page__message-copy-head span {
  color: #6f897b;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  
}

.applicant-inbox-page__message-copy-head strong {
  color: #1e412e;
  font-size: 0.92rem;
  
}

.applicant-inbox-page__message-body {
  display: grid;
  gap: 0.9rem;
}

.applicant-inbox-page__message-body p {
  margin: 0;
  color: #4c6558;
  font-size: 0.96rem;
  line-height: 1.7;
}

.applicant-inbox-page__message-body p.is-highlight {
  color: #284a38;
  font-size: 1rem;
}

.applicant-inbox-page__message-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.9rem 1.1rem;
  padding-top: 0.2rem;
}

.applicant-inbox-page__message-detail {
  display: grid;
  align-content: start;
  gap: 0.34rem;
  min-height: 3.6rem;
  padding-left: 0.9rem;
  border-left: 2px solid rgba(83, 128, 98, 0.18);
}

.applicant-inbox-page__message-detail span {
  color: #6e887a;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-inbox-page__message-detail strong {
  color: #183927;
  font-size: 0.96rem;
}

.applicant-inbox-page__list-empty,
.applicant-inbox-page__viewer-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.8rem;
  padding: 2rem;
  text-align: center;
  color: #5f7a6b;
}

.applicant-inbox-page__list-empty i,
.applicant-inbox-page__viewer-empty i {
  font-size: 2rem;
  color: #4a7b5f;
}

.applicant-inbox-page__list-empty h2,
.applicant-inbox-page__viewer-empty h2 {
  margin: 0;
  color: #1e412e;
  font-size: 1.12rem;
}

.applicant-inbox-page__list-empty p,
.applicant-inbox-page__viewer-empty p {
  margin: 0;
  max-width: 26rem;
  line-height: 1.65;
}

@keyframes applicantInboxViewerDots {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  40% {
    transform: translateY(-0.28rem);
    opacity: 1;
  }
}

@media (max-width: 1180px) {
  .applicant-inbox-page {
    min-height: auto;
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .applicant-inbox-page__hero {
    flex-direction: column;
  }

  .applicant-inbox-page__hero-tools {
    width: 100%;
    min-width: 0;
  }

  .applicant-inbox-page__shell {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }

  .applicant-inbox-page__sidebar {
    max-height: 28rem;
  }

  .applicant-inbox-page__viewer {
    min-height: 30rem;
  }
}

@media (max-width: 720px) {
  .applicant-inbox-page__hero,
  .applicant-inbox-page__message {
    padding-inline: 1rem;
  }

  .applicant-inbox-page__filters {
    padding-inline: 0.85rem;
  }

  .applicant-inbox-page__thread {
    padding-inline: 0.85rem;
  }

  .applicant-inbox-page__message-head {
    flex-direction: column;
    align-items: stretch;
  }

  .applicant-inbox-page__message-sender {
    grid-template-columns: 1fr;
  }

  .applicant-inbox-page__message-copy-head {
    display: grid;
    justify-content: start;
  }

  .applicant-inbox-page__message-time {
    justify-self: start;
  }

  .applicant-inbox-page__message-overview {
    grid-template-columns: 1fr;
  }

  .applicant-inbox-page__message-details {
    grid-template-columns: 1fr;
  }
}
</style>
