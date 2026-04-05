<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { computed, ref } from 'vue'

const props = defineProps({
  employees: {
    type: Array,
    default: () => [],
  },
})

const search = ref('')

const normalizeStatusValue = (value) => String(value || '').trim().toLowerCase()

const titleCaseText = (value, fallback = 'Not set') => {
  const text = String(value || '').trim()
  if (!text) return fallback

  return text
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const documentPathsForEmployee = (employee) => ([
  employee?.company_verification_document_1_path,
  employee?.company_verification_document_2_path,
  employee?.company_verification_document_3_path,
].filter((value) => String(value || '').trim()))

const businessStorageRows = computed(() =>
  (Array.isArray(props.employees) ? props.employees : []).map((employee) => {
    const documents = documentPathsForEmployee(employee)
    return {
      id: String(employee?.id || '').trim(),
      accountId: String(employee?.public_id || '').trim() || 'Pending ID',
      businessName: String(employee?.company_name || employee?.name || employee?.user?.name || 'Business').trim(),
      email: String(employee?.email || employee?.user?.email || 'No email').trim() || 'No email',
      status: titleCaseText(employee?.approval_status, 'Pending'),
      fileCount: documents.length,
      documentLabels: documents.map((path, index) => ({
        id: `${employee?.id || 'business'}-doc-${index + 1}`,
        label: `File ${index + 1}`,
        path,
      })),
      updatedAt: formatDate(employee?.reviewed_at || employee?.created_at),
    }
  }),
)

const filteredBusinessStorageRows = computed(() => {
  const query = String(search.value || '').trim().toLowerCase()
  if (!query) return businessStorageRows.value

  return businessStorageRows.value.filter((row) =>
    [
      row.accountId,
      row.businessName,
      row.email,
      row.status,
      ...row.documentLabels.map((item) => item.path),
    ]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(query)),
  )
})

const storageSummary = computed(() => {
  const rows = businessStorageRows.value
  const totalBusinesses = rows.length
  const totalFiles = rows.reduce((sum, row) => sum + row.fileCount, 0)
  const businessesWithFiles = rows.filter((row) => row.fileCount > 0).length
  const emptyBusinesses = totalBusinesses - businessesWithFiles

  return [
    { label: 'Business Accounts', value: totalBusinesses },
    { label: 'Stored Files', value: totalFiles },
    { label: 'With Storage', value: businessesWithFiles },
    { label: 'Empty Storage', value: emptyBusinesses },
  ]
})
</script>

<template>
  <section class="business-storage">
    <div class="business-storage__summary">
      <article v-for="card in storageSummary" :key="card.label" class="business-storage__summary-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div class="business-storage__toolbar">
      <label class="business-storage__search">
        <span>Search</span>
        <div class="business-storage__search-field">
          <i class="bi bi-search" aria-hidden="true" />
          <input
            v-model.trim="search"
            type="text"
            placeholder="Search business storage..."
          />
        </div>
      </label>
    </div>

    <div class="business-storage__panel">
      <div class="business-storage__head">
        <div>
          <h2>Business Storage</h2>
          <p>View attached business verification files and storage presence per account.</p>
        </div>
        <span class="business-storage__pill">{{ filteredBusinessStorageRows.length }} records</span>
      </div>

      <div v-if="filteredBusinessStorageRows.length" class="business-storage__table-shell">
        <table class="business-storage__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Business</th>
              <th>Status</th>
              <th>Storage Files</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredBusinessStorageRows" :key="row.id || row.accountId">
              <td>{{ row.accountId }}</td>
              <td>
                <div class="business-storage__business">
                  <strong>{{ row.businessName }}</strong>
                  <span>{{ row.email }}</span>
                </div>
              </td>
              <td>
                <span
                  class="business-storage__status"
                  :class="`is-${normalizeStatusValue(row.status)}`"
                >
                  {{ row.status }}
                </span>
              </td>
              <td>
                <div v-if="row.documentLabels.length" class="business-storage__files">
                  <span
                    v-for="item in row.documentLabels"
                    :key="item.id"
                    class="business-storage__file-chip"
                    :title="item.path"
                  >
                    {{ item.label }}
                  </span>
                </div>
                <span v-else class="business-storage__empty-copy">No files attached</span>
              </td>
              <td>{{ row.updatedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="business-storage__empty">
        <i class="bi bi-hdd-stack" aria-hidden="true" />
        <strong>No business storage records found.</strong>
        <span>Try another search or wait for business accounts with attached verification files.</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.business-storage {
  display: grid;
  gap: 1rem;
}

.business-storage__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.9rem;
}

.business-storage__summary-card {
  padding: 1rem 1.05rem;
  border: 1px solid rgba(122, 179, 145, 0.14);
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%);
  display: grid;
  gap: 0.2rem;
}

.business-storage__summary-card span {
  color: #6b8574;
  font-size: 0.75rem;
  font-weight: 700;
}

.business-storage__summary-card strong {
  color: #214133;
  font-size: 1.35rem;
  font-weight: 800;
}

.business-storage__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.business-storage__search {
  display: grid;
  gap: 0.38rem;
}

.business-storage__search span {
  color: #5c7b69;
  font-size: 0.76rem;
  font-weight: 700;
}

.business-storage__search-field {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.8rem;
  padding: 0 0.95rem;
  border: 1px solid rgba(122, 179, 145, 0.18);
  border-radius: 0.9rem;
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
}

.business-storage__search-field i {
  color: #7b8f83;
}

.business-storage__search-field input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #274234;
  font: inherit;
}

.business-storage__panel {
  border: 1px solid rgba(122, 179, 145, 0.14);
  border-radius: 1rem;
  background: #ffffff;
  overflow: hidden;
}

.business-storage__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.15rem 0.95rem;
  border-bottom: 1px solid rgba(122, 179, 145, 0.12);
}

.business-storage__head h2 {
  margin: 0;
  color: #1f3a2d;
  font-size: 1rem;
}

.business-storage__head p {
  margin: 0.18rem 0 0;
  color: #70877a;
  font-size: 0.8rem;
}

.business-storage__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid #d7dfd9;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
  font-size: 0.72rem;
  font-weight: 800;
}

.business-storage__table-shell {
  overflow-x: auto;
}

.business-storage__table {
  width: 100%;
  border-collapse: collapse;
}

.business-storage__table thead th {
  padding: 0.82rem 0.95rem;
  text-align: left;
  color: #6d8576;
  font-size: 0.76rem;
  font-weight: 700;
  background: #f7fbf8;
}

.business-storage__table tbody td {
  padding: 0.9rem 0.95rem;
  color: #35503f;
  font-size: 0.82rem;
  border-top: 1px solid rgba(122, 179, 145, 0.1);
  vertical-align: top;
}

.business-storage__business {
  display: grid;
  gap: 0.16rem;
}

.business-storage__business strong {
  color: #1f3a2d;
  font-size: 0.86rem;
}

.business-storage__business span {
  color: #7a9383;
  font-size: 0.76rem;
}

.business-storage__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6rem;
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(240, 154, 74, 0.2);
  background: rgba(240, 154, 74, 0.14);
  color: #be7b39;
  font-size: 0.74rem;
  font-weight: 700;
}

.business-storage__status.is-approved {
  border-color: #cfe6d7;
  background: linear-gradient(180deg, #ffffff 0%, #eef8f2 100%);
  color: #1f6f46;
}

.business-storage__status.is-rejected,
.business-storage__status.is-banned {
  border-color: rgba(223, 115, 134, 0.18);
  background: rgba(223, 115, 134, 0.12);
  color: #bf5f72;
}

.business-storage__files {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  flex-wrap: wrap;
}

.business-storage__file-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.9rem;
  padding: 0.25rem 0.62rem;
  border: 1px solid #d7dfd9;
  border-radius: 999px;
  background: #f8fbf9;
  color: #305141;
  font-size: 0.71rem;
  font-weight: 700;
}

.business-storage__empty-copy {
  color: #8aa093;
  font-size: 0.76rem;
}

.business-storage__empty {
  padding: 2.2rem 1.2rem;
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  text-align: center;
  color: #6f8578;
}

.business-storage__empty i {
  font-size: 1.5rem;
  color: #7aa187;
}

.business-storage__empty strong {
  color: #214133;
  font-size: 0.95rem;
}

.business-storage__empty span {
  font-size: 0.78rem;
  max-width: 30rem;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .business-storage__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .business-storage__summary {
    grid-template-columns: 1fr;
  }
}
</style>
