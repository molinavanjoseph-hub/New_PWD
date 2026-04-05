<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import mathLogo from '@/assets/math.png'
import { clearAuthSession, getAccountApprovalStatus, getStoredAuthUser } from '@/lib/auth'

const router = useRouter()
const authUser = ref(null)
const companyName = computed(() => authUser.value?.company_name || authUser.value?.name || 'Company Workspace')

const logout = async () => {
  clearAuthSession()
  sessionStorage.setItem('showLoggedOutToast', '1')
  await router.push('/login')
}

onMounted(async () => {
  const user = getStoredAuthUser()
  if (!user || user.role !== 'employer') {
    router.replace('/login')
    return
  }

  authUser.value = user

  try {
    const status = await getAccountApprovalStatus(user.email)
    if (!status || status.status !== 'approved') {
      clearAuthSession()
      await router.replace('/login')
    }
  } catch {
    clearAuthSession()
    await router.replace('/login')
  }
})
</script>

<template>
  <div class="company-workspace">
    <div class="company-workspace__card">
      <img :src="mathLogo" alt="Math logo" />
      <p>Company Workspace</p>
      <h1>{{ companyName }}</h1>
      <span>Company dashboard is ready for the next layout step.</span>
      <button type="button" @click="logout">Log Out</button>
    </div>
  </div>
</template>

<style scoped>
.company-workspace {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: linear-gradient(180deg, #f4f8f4 0%, #fbfdfb 100%);
}

.company-workspace__card {
  width: min(30rem, 100%);
  padding: 2rem;
  border: 1px solid #dce7df;
  border-radius: 24px;
  background: #ffffff;
  text-align: center;
  color: #1d3025;
}

.company-workspace__card img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.company-workspace__card p {
  margin: 1rem 0 0;
  color: #6d8175;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.company-workspace__card h1 {
  margin: 0.45rem 0 0;
}

.company-workspace__card span {
  display: block;
  margin-top: 0.7rem;
  color: #617267;
}

.company-workspace__card button {
  margin-top: 1.25rem;
  padding: 0.85rem 1.1rem;
  border: 0;
  border-radius: 999px;
  background: #1f7448;
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
</style>
