<script setup>
import { computed } from 'vue'

const props = defineProps({
  offerRecords: {
    type: Array,
    default: () => [],
  },
})

const totalOffers = computed(() => props.offerRecords.length)
const hiredOffers = computed(() =>
  props.offerRecords.filter((record) => String(record?.offerLabel || '').trim().toLowerCase() === 'hired').length,
)
const acceptedOffers = computed(() =>
  props.offerRecords.filter((record) => String(record?.offerLabel || '').trim().toLowerCase() === 'offer accepted').length,
)

const getCompanyInitial = (value) => String(value || 'J').trim().charAt(0).toUpperCase() || 'J'
</script>

<template>
  <section class="applicant-job-offers-page">
    <article class="applicant-job-offers-page__panel">
      <header class="applicant-job-offers-page__hero">
        <div class="applicant-job-offers-page__hero-copy">
          <p class="applicant-job-offers-page__eyebrow">Job Offers</p>
          <h2>Final offers and hiring results</h2>
          <p>Review finalized offers and live hiring decisions from employers in one place.</p>
        </div>

        <div class="applicant-job-offers-page__hero-stats" aria-label="Job offer summary">
          <article class="applicant-job-offers-page__stat">
            <span>Total Offers</span>
            <strong>{{ totalOffers }}</strong>
          </article>
          <article class="applicant-job-offers-page__stat">
            <span>Accepted</span>
            <strong>{{ acceptedOffers }}</strong>
          </article>
          <article class="applicant-job-offers-page__stat">
            <span>Hired</span>
            <strong>{{ hiredOffers }}</strong>
          </article>
        </div>
      </header>

      <div v-if="offerRecords.length" class="applicant-job-offers-page__list">
        <article
          v-for="(record, index) in offerRecords"
          :key="record.id"
          class="applicant-job-offers-page__card"
          :style="{ '--offer-enter-delay': `${index * 60}ms` }"
        >
          <div class="applicant-job-offers-page__card-head">
            <div class="applicant-job-offers-page__identity">
              <span class="applicant-job-offers-page__avatar" aria-hidden="true">
                <img
                  v-if="record.logoUrl"
                  :src="record.logoUrl"
                  alt=""
                  class="applicant-job-offers-page__avatar-image"
                />
                <template v-else>{{ getCompanyInitial(record.company) }}</template>
              </span>

              <div class="applicant-job-offers-page__identity-copy">
                <h3>{{ record.title }}</h3>
                <p>{{ record.company }}</p>
              </div>
            </div>

            <span class="applicant-job-offers-page__status-pill" :class="`is-${record.offerTone || 'success'}`">
              <i class="bi bi-briefcase-fill" aria-hidden="true" />
              {{ record.offerLabel }}
            </span>
          </div>

          <div class="applicant-job-offers-page__meta">
            <span>
              <i class="bi bi-geo-alt" aria-hidden="true" />
              {{ record.location }}
            </span>
            <span>
              <i class="bi bi-briefcase" aria-hidden="true" />
              {{ record.jobType }}
            </span>
            <span>
              <i class="bi bi-cash-coin" aria-hidden="true" />
              {{ record.salaryLabel }}
            </span>
            <span>
              <i class="bi bi-universal-access" aria-hidden="true" />
              {{ record.disabilityLabel }}
            </span>
          </div>

          <p class="applicant-job-offers-page__summary">
            {{ record.offerSummary }}
          </p>

          <footer class="applicant-job-offers-page__footer">
            <span>
              <strong>Applied:</strong> {{ record.submittedAtLabel }}
            </span>
            <span>
              <strong>Updated:</strong> {{ record.updatedAtLabel }}
            </span>
          </footer>
        </article>
      </div>

      <div v-else class="applicant-job-offers-page__empty">
        <i class="bi bi-briefcase" aria-hidden="true" />
        <h3>No job offers yet</h3>
        <p>Employers will appear here once they send a finalized offer or hiring result for your application.</p>
      </div>
    </article>
  </section>
</template>

<style scoped>
.applicant-job-offers-page {
  display: grid;
  min-height: min(46rem, calc(100vh - 9rem));
}

.applicant-job-offers-page__panel {
  display: grid;
  gap: 1.2rem;
  padding: 1.2rem;
  border: 1px solid rgba(66, 112, 87, 0.18);
  background:
    radial-gradient(circle at top left, rgba(222, 243, 231, 0.72), transparent 38%),
    linear-gradient(180deg, rgba(248, 252, 250, 0.97), rgba(255, 255, 255, 0.98));
  box-shadow: 0 18px 36px rgba(31, 74, 51, 0.08);
}

.applicant-job-offers-page__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(66, 112, 87, 0.14);
  background: rgba(255, 255, 255, 0.84);
}

.applicant-job-offers-page__hero-copy {
  display: grid;
  gap: 0.45rem;
  max-width: 36rem;
}

.applicant-job-offers-page__eyebrow {
  margin: 0;
  color: #5f7d6c;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.applicant-job-offers-page__hero-copy h2 {
  margin: 0;
  color: #173927;
  font-size: clamp(1.35rem, 1.9vw, 1.8rem);
  line-height: 1.15;
}

.applicant-job-offers-page__hero-copy p:last-child {
  margin: 0;
  color: #5f7c6d;
  font-size: 0.94rem;
  line-height: 1.6;
}

.applicant-job-offers-page__hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(7rem, 1fr));
  gap: 0.75rem;
  min-width: min(100%, 24rem);
}

.applicant-job-offers-page__stat {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(66, 112, 87, 0.14);
  background: rgba(245, 250, 247, 0.95);
}

.applicant-job-offers-page__stat span {
  color: #6a8678;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.applicant-job-offers-page__stat strong {
  color: #173927;
  font-size: 1.55rem;
  line-height: 1;
}

.applicant-job-offers-page__list {
  display: grid;
  gap: 1rem;
}

.applicant-job-offers-page__card {
  display: grid;
  gap: 0.95rem;
  padding: 1.05rem 1.1rem;
  border: 1px solid rgba(66, 112, 87, 0.14);
  background: rgba(255, 255, 255, 0.96);
  animation: applicant-job-offers-page-enter 0.28s ease both;
  animation-delay: var(--offer-enter-delay, 0ms);
}

.applicant-job-offers-page__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.applicant-job-offers-page__identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.applicant-job-offers-page__avatar {
  display: inline-grid;
  place-items: center;
  width: 2.9rem;
  aspect-ratio: 1;
  border: 1px solid rgba(66, 112, 87, 0.16);
  border-radius: 0.9rem;
  background: linear-gradient(135deg, rgba(220, 242, 228, 0.94), rgba(247, 252, 249, 0.96));
  color: #1d573b;
  font-size: 1rem;
  font-weight: 800;
  overflow: hidden;
  text-transform: uppercase;
}

.applicant-job-offers-page__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.applicant-job-offers-page__identity-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.applicant-job-offers-page__identity-copy h3 {
  margin: 0;
  color: #173927;
  font-size: 1.2rem;
  line-height: 1.2;
}

.applicant-job-offers-page__identity-copy p {
  margin: 0;
  color: #5d7a6b;
  font-size: 0.92rem;
}

.applicant-job-offers-page__status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(32, 118, 76, 0.18);
  background: rgba(225, 245, 233, 0.96);
  color: #176a42;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.applicant-job-offers-page__status-pill.is-success {
  border-color: rgba(22, 163, 74, 0.2);
  background: rgba(225, 245, 233, 0.96);
  color: #176a42;
}

.applicant-job-offers-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  color: #5d7a6b;
  font-size: 0.84rem;
}

.applicant-job-offers-page__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.applicant-job-offers-page__summary {
  margin: 0;
  color: #234432;
  font-size: 0.94rem;
  line-height: 1.65;
}

.applicant-job-offers-page__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.4rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(66, 112, 87, 0.12);
  color: #688373;
  font-size: 0.82rem;
}

.applicant-job-offers-page__footer strong {
  color: #234432;
}

.applicant-job-offers-page__empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.7rem;
  min-height: 18rem;
  padding: 2rem;
  border: 1px dashed rgba(66, 112, 87, 0.24);
  background: rgba(255, 255, 255, 0.74);
  text-align: center;
}

.applicant-job-offers-page__empty i {
  color: #3f775a;
  font-size: 2rem;
}

.applicant-job-offers-page__empty h3 {
  margin: 0;
  color: #193826;
  font-size: 1.1rem;
}

.applicant-job-offers-page__empty p {
  margin: 0;
  max-width: 30rem;
  color: #5f7c6d;
  font-size: 0.93rem;
  line-height: 1.65;
}

@keyframes applicant-job-offers-page-enter {
  from {
    opacity: 0;
    transform: translateY(0.45rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1180px) {
  .applicant-job-offers-page__hero {
    flex-direction: column;
  }

  .applicant-job-offers-page__hero-stats {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .applicant-job-offers-page__hero-stats {
    grid-template-columns: 1fr;
  }

  .applicant-job-offers-page__card-head {
    flex-direction: column;
  }

  .applicant-job-offers-page__status-pill {
    white-space: normal;
  }
}
</style>
