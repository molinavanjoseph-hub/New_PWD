<script setup>
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import mathLogo from '@/assets/math.png'

const props = defineProps({
  users: {
    type: Array,
    default: () => [],
  },
  filterSummary: {
    type: String,
    default: '0 of 0 users',
  },
  formatDate: {
    type: Function,
    required: true,
  },
})

const fetchAssetAsDataUrl = async (assetUrl) => {
  if (typeof window === 'undefined') return ''

  const response = await fetch(assetUrl)
  const blob = await response.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read asset.'))
    reader.readAsDataURL(blob)
  })
}

const exportUsersToExcel = async () => {
  if (typeof window === 'undefined') return

  const rows = props.users.map((user, index) => ([
    index + 1,
    user.accountId,
    user.name,
    user.email,
    user.role,
    user.status,
    props.formatDate(user.date),
  ]))

  const logoDataUrl = await fetchAssetAsDataUrl(mathLogo).catch(() => '')
  const tableRows = rows.map((row) => `
    <tr>${row.map((cell) => `<td>${String(cell ?? '')}</td>`).join('')}</tr>
  `).join('')

  const workbookContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
          .sheet-header { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
          .sheet-header img { width: 82px; height: 82px; object-fit: contain; }
          .sheet-header__copy h1 { margin: 0; font-size: 24px; }
          .sheet-header__copy p { margin: 4px 0 0; color: #4b5563; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background: #edf6f0; font-weight: 700; color: #214133; }
          tbody tr:nth-child(even) { background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="sheet-header">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : ''}
          <div class="sheet-header__copy">
            <h1>All Users</h1>
            <p>${props.filterSummary}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob([workbookContent], { type: 'application/octet-stream' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `all-users-${dateStamp}.xls`
  link.target = '_self'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const printUsers = () => {
  if (typeof window === 'undefined') return

  const rowsMarkup = props.users.map((user, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${user.accountId}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>${user.status}</td>
      <td>${props.formatDate(user.date)}</td>
    </tr>
  `).join('')

  const printFrame = document.createElement('iframe')
  printFrame.style.position = 'fixed'
  printFrame.style.right = '0'
  printFrame.style.bottom = '0'
  printFrame.style.width = '0'
  printFrame.style.height = '0'
  printFrame.style.border = '0'
  printFrame.setAttribute('aria-hidden', 'true')
  document.body.appendChild(printFrame)

  const printDocument = printFrame.contentWindow?.document
  if (!printDocument || !printFrame.contentWindow) {
    document.body.removeChild(printFrame)
    return
  }

  printDocument.open()
  printDocument.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>All Users</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 0 0 18px; color: #4b5563; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; font-weight: 700; }
          tbody tr:nth-child(even) { background: #f9fafb; }
        </style>
      </head>
      <body>
        <h1>All Users</h1>
        <p>${props.filterSummary}</p>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${rowsMarkup}</tbody>
        </table>
      </body>
    </html>
  `)
  printDocument.close()

  window.setTimeout(() => {
    printFrame.contentWindow?.focus()
    printFrame.contentWindow?.print()
    window.setTimeout(() => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame)
      }
    }, 400)
  }, 150)
}
</script>

<template>
  <div class="admin-all-users-csv">
    <button type="button" class="admin-all-users-csv__btn" @click="exportUsersToExcel">
      <i class="bi bi-download" aria-hidden="true" />
      <span>Export Excel</span>
    </button>
    <button type="button" class="admin-all-users-csv__btn" @click="printUsers">
      <i class="bi bi-printer" aria-hidden="true" />
      <span>Print</span>
    </button>
  </div>
</template>

<style scoped>
.admin-all-users-csv {
  align-self: end;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.admin-all-users-csv__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.45rem;
  padding: 0.55rem 1rem;
  border: 1px solid #d7dfd9;
  border-radius: 0.82rem;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9f7 100%);
  color: #305141;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;
}

.admin-all-users-csv__btn i {
  font-size: 0.82rem;
}

.admin-all-users-csv__btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
}

@media (max-width: 768px) {
  .admin-all-users-csv {
    width: 100%;
  }

  .admin-all-users-csv__btn {
    flex: 1 1 calc(50% - 0.3rem);
    min-width: 0;
  }
}

@media (max-width: 520px) {
  .admin-all-users-csv__btn {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
