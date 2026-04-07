<script setup>
import { toRefs } from 'vue'
const props = defineProps([
  'canViewTrainingTemplateBuilder',
  'canViewTrainingAssignments',
  'trainingTemplatesTab',
  'setTrainingTemplatesTab',
  'canEditBusinessModule',
  'editingTrainingTemplateId',
  'handleTrainingTemplateSelection',
  'trainingTemplateLibrary',
  'countTrainingTemplateCategories',
  'countTrainingTemplateSkills',
  'startNewTrainingTemplate',
  'deleteTrainingTemplate',
  'saveTrainingTemplate',
  'trainingTemplateDraft',
  'addTrainingTemplateCategory',
  'removeTrainingTemplateCategory',
  'addTrainingTemplateSkill',
  'removeTrainingTemplateSkill',
  'readyTrainingTemplateRows',
  'assignedTrainingTemplateRows',
  'trainingTrackingAssignments',
  'trainingAssignmentTab',
  'setTrainingAssignmentTab',
  'canEditTrainingAssignments',
  'assignableTrainingTemplates',
  'assignTrainingTemplateToMember',
  'removeAssignedTrainingTemplateFromMember',
  'getAssignableTrainingTemplateLabel',
  'resolveTrainingTrackingProgressTone',
  'isTrainingTrackingDetailView',
  'selectedTrainingTrackingAssignment',
  'openTrainingTrackingDetail',
  'returnToTrainingTrackingTable',
  'isTrainingTrackingCategorySelected',
  'toggleTrainingTrackingCategorySelection',
  'isTrainingTrackingSkillSelected',
  'toggleTrainingTrackingSkillSelection',
  'TRAINING_TRACKING_GRADE_SCALE',
  'isTrainingTrackingSkillSaving',
  'toggleTrainingAssignmentSkillCompletion',
  'setTrainingAssignmentSkillGrade',
  'isTrainingTrackingCategorySaving',
  'formatBusinessInterviewDateTime',
  'getTrainingTrackingCategoryRemarkDraft',
  'setTrainingTrackingCategoryRemarkDraft',
  'saveTrainingTrackingCategoryRemark',
  'isTrainingTrackingAssignmentCompleting',
  'completeTrainingTrackingAssignment',
])
const {
  canViewTrainingTemplateBuilder,
  canViewTrainingAssignments,
  trainingTemplatesTab,
  setTrainingTemplatesTab,
  canEditBusinessModule,
  editingTrainingTemplateId,
  handleTrainingTemplateSelection,
  trainingTemplateLibrary,
  countTrainingTemplateCategories,
  countTrainingTemplateSkills,
  startNewTrainingTemplate,
  deleteTrainingTemplate,
  saveTrainingTemplate,
  trainingTemplateDraft,
  addTrainingTemplateCategory,
  removeTrainingTemplateCategory,
  addTrainingTemplateSkill,
  removeTrainingTemplateSkill,
  readyTrainingTemplateRows,
  assignedTrainingTemplateRows,
  trainingTrackingAssignments,
  trainingAssignmentTab,
  setTrainingAssignmentTab,
  canEditTrainingAssignments,
  assignableTrainingTemplates,
  assignTrainingTemplateToMember,
  removeAssignedTrainingTemplateFromMember,
  getAssignableTrainingTemplateLabel,
  resolveTrainingTrackingProgressTone,
  isTrainingTrackingDetailView,
  selectedTrainingTrackingAssignment,
  openTrainingTrackingDetail,
  returnToTrainingTrackingTable,
  isTrainingTrackingCategorySelected,
  toggleTrainingTrackingCategorySelection,
  isTrainingTrackingSkillSelected,
  toggleTrainingTrackingSkillSelection,
  TRAINING_TRACKING_GRADE_SCALE,
  isTrainingTrackingSkillSaving,
  toggleTrainingAssignmentSkillCompletion,
  setTrainingAssignmentSkillGrade,
  isTrainingTrackingCategorySaving,
  formatBusinessInterviewDateTime,
  getTrainingTrackingCategoryRemarkDraft,
  setTrainingTrackingCategoryRemarkDraft,
  saveTrainingTrackingCategoryRemark,
  isTrainingTrackingAssignmentCompleting,
  completeTrainingTrackingAssignment,
} = toRefs(props)
</script>

<template>
<section class="business-assessment-management business-training-management">
              <div class="business-assessment-management__tabs" role="tablist" aria-label="Training template views">
                <button
                  v-if="canViewTrainingTemplateBuilder"
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': trainingTemplatesTab === 'builder' }"
                  @click="setTrainingTemplatesTab('builder')"
                >
                  Create Template
                </button>
                <button
                  v-if="canViewTrainingAssignments"
                  type="button"
                  class="business-assessment-management__tab"
                  :class="{ 'is-active': trainingTemplatesTab === 'assignments' }"
                  @click="setTrainingTemplatesTab('assignments')"
                >
                  Assign Templates
                </button>
              </div>

              <div v-if="trainingTemplatesTab === 'builder' && canViewTrainingTemplateBuilder" class="business-template-builder">
                <div class="business-template-builder__editor">
                  <fieldset class="business-template-builder__fieldset" :disabled="!canEditBusinessModule('training-templates')">
                    <div class="business-assessment-builder__bar">
                      <label class="business-template-builder__select-wrap business-assessment-builder__picker">
                        <span>{{ editingTrainingTemplateId ? 'Editing Template' : 'Open Template' }}</span>
                        <select :value="editingTrainingTemplateId" @change="handleTrainingTemplateSelection($event.target.value)">
                          <option value="">New template</option>
                          <option v-for="template in trainingTemplateLibrary" :key="template.id" :value="template.id">
                            {{ template.title || 'Untitled template' }} | {{ countTrainingTemplateCategories(template) }} categories | {{ countTrainingTemplateSkills(template) }} skills
                          </option>
                        </select>
                      </label>
                      <div class="business-assessment-builder__bar-status">
                        <div class="business-assessment-builder__status-card">
                          <strong>{{ trainingTemplateLibrary.length }}</strong>
                          <span>Saved</span>
                        </div>
                      </div>
                      <div class="business-template-builder__hero-actions">
                        <button
                          type="button"
                          class="business-template-builder__publish business-template-builder__publish--secondary"
                          @click="startNewTrainingTemplate"
                        >
                          New
                        </button>
                        <button
                          v-if="editingTrainingTemplateId"
                          type="button"
                          class="business-template-builder__publish business-template-builder__publish--danger"
                          @click="deleteTrainingTemplate"
                        >
                          Delete
                        </button>
                        <button type="button" class="business-template-builder__publish" @click="saveTrainingTemplate">
                          {{ editingTrainingTemplateId ? 'Update' : 'Save' }}
                        </button>
                      </div>
                    </div>
                    <p v-if="editingTrainingTemplateId" class="business-assessment-builder__bar-note">
                      Deleting removes the selected saved template from the library only.
                    </p>

                    <div class="business-template-builder__hero">
                      <div>
                        <p class="business-template-builder__eyebrow">Training Builder</p>
                        <h2>Build reusable training templates in one workspace</h2>
                        <p>Organize each template by training category, then list the skills your team member should learn under every category.</p>
                      </div>
                    </div>

                    <article class="business-template-builder__card business-template-builder__card--header">
                      <label class="business-template-builder__field">
                        <span>Template Title</span>
                        <input v-model="trainingTemplateDraft.title" type="text" placeholder="New hire onboarding checklist" />
                      </label>
                      <label class="business-template-builder__field">
                        <span>Description</span>
                        <textarea v-model="trainingTemplateDraft.description" rows="3" placeholder="Describe what this training template covers." />
                      </label>
                      <label class="business-template-builder__field">
                        <span>Passing Score (%)</span>
                        <input
                          v-model.number="trainingTemplateDraft.passingScorePercent"
                          type="number"
                          min="1"
                          max="100"
                          placeholder="70"
                        />
                      </label>
                    </article>

                    <article class="business-template-builder__card business-template-builder__toolbar">
                      <div class="business-template-builder__toolbar-copy">
                        <strong>Build The Training Flow</strong>
                        <span>Add training categories, then customize the skills inside each one.</span>
                      </div>
                      <div class="business-template-builder__toolbar-actions">
                        <button type="button" class="business-template-builder__add" @click="addTrainingTemplateCategory">
                          <i class="bi bi-plus-lg" aria-hidden="true" />
                          Add category
                        </button>
                      </div>
                    </article>

                    <TransitionGroup name="business-template-question" tag="div" class="business-template-builder__questions">
                      <article
                        v-for="(category, index) in trainingTemplateDraft.categories"
                        :key="category.id"
                        class="business-template-builder__card business-template-builder__question"
                      >
                        <div class="business-template-builder__question-top">
                          <div class="business-template-builder__question-meta">
                            <span class="business-template-builder__question-order">Category {{ index + 1 }}</span>
                            <span class="business-template-builder__question-type">
                              <i class="bi bi-diagram-3" aria-hidden="true" />
                              {{ category.skills.length }} skill{{ category.skills.length === 1 ? '' : 's' }}
                            </span>
                          </div>
                          <button type="button" class="business-template-builder__remove" @click="removeTrainingTemplateCategory(category.id)">
                            Remove
                          </button>
                        </div>

                        <label class="business-template-builder__field">
                          <span>Training Category</span>
                          <input v-model="category.title" type="text" placeholder="Communication Foundations" />
                        </label>

                        <div class="business-template-builder__options">
                          <div class="business-template-builder__option-actions">
                            <span>Skills</span>
                            <button type="button" class="business-template-builder__option-add" @click="addTrainingTemplateSkill(category.id)">
                              <i class="bi bi-plus-lg" aria-hidden="true" />
                              Add skill
                            </button>
                          </div>

                          <div class="business-template-builder__skill-list">
                            <div
                              v-for="skill in category.skills"
                              :key="skill.id"
                              class="business-template-builder__skill-item"
                            >
                              <div class="business-template-builder__option-row business-template-builder__option-row--skill">
                                <input v-model="skill.name" type="text" placeholder="Skill name" />
                                <button type="button" class="business-template-builder__option-remove" @click="removeTrainingTemplateSkill(category.id, skill.id)">
                                  Remove
                                </button>
                              </div>
                              <input
                                v-model="skill.description"
                                class="business-template-builder__skill-detail-input"
                                type="text"
                                placeholder="Skill details or short note"
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    </TransitionGroup>
                  </fieldset>
                </div>

                <aside class="business-template-preview">
                  <div class="business-template-preview__shell">
                    <div class="business-template-preview__topbar">
                      <span class="business-template-preview__badge">Live Preview</span>
                      <strong>Training Preview</strong>
                    </div>
                    <article class="business-template-preview__form">
                      <div class="business-template-preview__header">
                        <h3 :class="{ 'business-template-preview__placeholder': !trainingTemplateDraft.title }">
                          {{ trainingTemplateDraft.title || 'Untitled training template' }}
                        </h3>
                        <p :class="{ 'business-template-preview__placeholder': !trainingTemplateDraft.description }">
                          {{ trainingTemplateDraft.description || 'Add a short description so team members know what this training covers.' }}
                        </p>
                      </div>

                      <div class="business-template-preview__details">
                        <div class="business-template-preview__detail">
                          <span>Categories</span>
                          <strong>{{ countTrainingTemplateCategories(trainingTemplateDraft) }}</strong>
                        </div>
                        <div class="business-template-preview__detail">
                          <span>Total Skills</span>
                          <strong>{{ countTrainingTemplateSkills(trainingTemplateDraft) }}</strong>
                        </div>
                        <div class="business-template-preview__detail">
                          <span>Format</span>
                          <strong>Custom Skill Map</strong>
                        </div>
                        <div class="business-template-preview__detail">
                          <span>Passing Score</span>
                          <strong>{{ trainingTemplateDraft.passingScorePercent || 70 }}%</strong>
                        </div>
                      </div>

                      <article
                        v-for="(category, index) in trainingTemplateDraft.categories"
                        :key="`${category.id}-preview`"
                        class="business-template-preview__question"
                      >
                        <div class="business-template-preview__question-head">
                          <span>Category {{ index + 1 }}</span>
                          <small>{{ category.skills.length }} skill{{ category.skills.length === 1 ? '' : 's' }}</small>
                        </div>
                        <strong :class="{ 'business-template-preview__placeholder': !category.title }">
                          {{ category.title || 'Untitled category' }}
                        </strong>

                        <div class="business-template-preview__training-skills">
                          <div
                            v-for="skill in category.skills"
                            :key="`${skill.id}-preview`"
                            class="business-template-preview__training-skill"
                          >
                            <div class="business-template-preview__training-skill-copy">
                              <strong :class="{ 'business-template-preview__placeholder': !skill.name }">
                                {{ skill.name || 'Untitled skill' }}
                              </strong>
                              <p v-if="skill.description">{{ skill.description }}</p>
                            </div>
                          </div>
                        </div>
                      </article>

                      <div class="business-template-preview__footer">
                        <button type="button" disabled>Start Training Plan</button>
                      </div>
                    </article>
                  </div>
                </aside>
              </div>

              <div v-else-if="canViewTrainingAssignments" class="business-assign-templates">
                <div class="business-assign-templates__header">
                  <div>
                    <p class="business-assign-templates__eyebrow">Training Assignment</p>
                    <h2>Assign saved training templates without leaving this page</h2>
                    <p>Choose a saved training template and assign it only to applicants who already completed the interview.</p>
                  </div>
                  <div class="business-assign-templates__summary">
                    <span>{{ readyTrainingTemplateRows.length }} ready applicants</span>
                    <span>{{ assignedTrainingTemplateRows.length }} templates assigned</span>
                    <span>{{ trainingTrackingAssignments.length }} in tracking</span>
                  </div>
                </div>

                <div class="business-assign-templates__tabs">
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'ready-members' }"
                    @click="setTrainingAssignmentTab('ready-members')"
                  >
                    Ready Applicants
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'assigned-templates' }"
                    @click="setTrainingAssignmentTab('assigned-templates')"
                  >
                    Assigned Templates
                  </button>
                  <button
                    type="button"
                    class="business-assign-templates__tab"
                    :class="{ 'is-active': trainingAssignmentTab === 'training-tracking' }"
                    @click="setTrainingAssignmentTab('training-tracking')"
                  >
                    Training Tracking
                  </button>
                </div>

                <article v-if="trainingAssignmentTab === 'ready-members'" class="business-assign-templates__panel">
                  <div v-if="readyTrainingTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Training Stage</th>
                          <th>Template</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="member in readyTrainingTemplateRows" :key="member.id">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ member.name }}</strong>
                              <span>{{ member.email }}</span>
                            </div>
                          </td>
                          <td>{{ member.role }}</td>
                          <td>{{ member.stage }}</td>
                          <td>
                            <select
                              v-model="member.selectedTemplateId"
                              class="business-assign-templates__select"
                              :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length"
                            >
                              <option value="">
                                {{ assignableTrainingTemplates.length ? 'Select template' : 'No saved templates yet' }}
                              </option>
                              <option v-for="template in assignableTrainingTemplates" :key="template.id" :value="template.id">
                                {{ template.title }}
                              </option>
                            </select>
                          </td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="{ 'is-assigned': String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' }"
                            >
                              {{ member.assignmentStatus }}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              class="business-assign-templates__action business-assign-templates__action--icon"
                              :title="String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' ? 'Update training assignment' : 'Assign training template'"
                              :aria-label="String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' ? 'Update training assignment' : 'Assign training template'"
                              :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length"
                              @click="assignTrainingTemplateToMember(member.id)"
                            >
                              <i :class="String(member.assignmentStatus || '').trim().toLowerCase() === 'assigned' ? 'bi bi-arrow-repeat' : 'bi bi-send'" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No applicants are ready for training assignment yet</strong>
                    <p>Only applicants with a completed interview will appear in this table.</p>
                  </div>
                </article>

                <article v-else-if="trainingAssignmentTab === 'assigned-templates'" class="business-assign-templates__panel">
                  <div v-if="assignedTrainingTemplateRows.length" class="business-assign-templates__table-wrap">
                    <table class="business-assign-templates__table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Position</th>
                          <th>Assigned Template</th>
                          <th>Assigned Date</th>
                          <th>Progress</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="member in assignedTrainingTemplateRows" :key="`${member.id}-assigned`">
                          <td>
                            <div class="business-assign-templates__applicant">
                              <strong>{{ member.name }}</strong>
                              <span>{{ member.email }}</span>
                            </div>
                          </td>
                          <td>{{ member.role }}</td>
                          <td>
                            <select
                              v-model="member.selectedTemplateId"
                              class="business-assign-templates__select"
                              :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length"
                            >
                              <option value="">
                                {{ assignableTrainingTemplates.length ? 'Select template' : 'No saved templates yet' }}
                              </option>
                              <option v-for="template in assignableTrainingTemplates" :key="template.id" :value="template.id">
                                {{ template.title }}
                              </option>
                            </select>
                          </td>
                          <td>{{ member.assignedAt || 'Not set' }}</td>
                          <td>
                            <span
                              class="business-assign-templates__status"
                              :class="`is-progress-${resolveTrainingTrackingProgressTone(member.progressStatus)}`"
                            >
                              {{ member.progressStatus }}
                            </span>
                          </td>
                          <td>
                            <div class="business-assign-templates__actions">
                              <button
                                type="button"
                                class="business-assign-templates__action business-assign-templates__action--icon"
                                title="Reassign training template"
                                aria-label="Reassign training template"
                                :disabled="!canEditTrainingAssignments || !assignableTrainingTemplates.length || !member.selectedTemplateId"
                                @click="assignTrainingTemplateToMember(member.id)"
                              >
                                <i class="bi bi-arrow-repeat" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                class="business-assign-templates__action business-assign-templates__action--icon business-assign-templates__action--danger"
                                title="Remove assigned template"
                                aria-label="Remove assigned template"
                                :disabled="!canEditTrainingAssignments"
                                @click="removeAssignedTrainingTemplateFromMember(member.id)"
                              >
                                <i class="bi bi-trash3" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No training templates assigned yet</strong>
                    <p>Save a training template first, then assign it from the ready applicants tab.</p>
                  </div>
                </article>

                <article v-else-if="trainingAssignmentTab === 'training-tracking'" class="business-assign-templates__panel business-assign-templates__panel--tracking">
                  <div v-if="trainingTrackingAssignments.length" class="business-assign-templates__tracking">
                    <div v-if="!isTrainingTrackingDetailView" class="business-assign-templates__tracking-table-view">
                      <div class="business-assign-templates__tracking-view-head">
                        <div>
                          <p class="business-assign-templates__eyebrow">Training Tracking Queue</p>
                          <h3>Applicants with assigned training templates</h3>
                          <p>Select one applicant to open the dedicated training progress page.</p>
                        </div>
                      </div>

                      <div class="business-assign-templates__table-wrap">
                        <table class="business-assign-templates__table">
                          <thead>
                            <tr>
                              <th>Applicant</th>
                              <th>Position</th>
                            <th>Assigned Template</th>
                            <th>Overall Progress</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="assignment in trainingTrackingAssignments" :key="`${assignment.id}-tracking`">
                            <td>
                              <div class="business-assign-templates__applicant">
                                <strong>{{ assignment.name }}</strong>
                                <span>{{ assignment.email }}</span>
                              </div>
                            </td>
                            <td>{{ assignment.role }}</td>
                            <td>{{ getAssignableTrainingTemplateLabel(assignment.selectedTemplateId, assignment.templateTitle) }}</td>
                            <td>
                              <div class="business-assign-templates__tracking-progress-cell">
                                <strong>{{ assignment.overallProgress.percent }}%</strong>
                                <span>{{ assignment.overallProgress.completedSkills }}/{{ assignment.overallProgress.totalSkills || 0 }} skills</span>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                class="business-assign-templates__action"
                                :class="{
                                  'business-assign-templates__action--icon': true,
                                  'business-assign-templates__action--active': isTrainingTrackingDetailView && selectedTrainingTrackingAssignment?.id === assignment.id,
                                }"
                                title="View training tracking details"
                                aria-label="View training tracking details"
                                @click="openTrainingTrackingDetail(assignment.id)"
                              >
                                <i class="bi bi-eye" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    </div>

                    <section v-else-if="selectedTrainingTrackingAssignment" class="business-assign-templates__tracking-detail-view">
                      <div class="business-assign-templates__tracking-view-head business-assign-templates__tracking-view-head--detail">
                        <button
                          type="button"
                          class="business-assign-templates__back-button"
                          @click="returnToTrainingTrackingTable"
                        >
                          <i class="bi bi-arrow-left" aria-hidden="true" />
                          Back to Applicant Table
                        </button>
                        <span>Selected applicant training progress</span>
                      </div>

                      <section class="business-assign-templates__tracking-detail">
                      <div class="business-assign-templates__tracking-detail-top">
                        <div>
                          <p class="business-assign-templates__eyebrow">Training Progress</p>
                          <h3>{{ selectedTrainingTrackingAssignment.name }}</h3>
                          <p>
                            {{ getAssignableTrainingTemplateLabel(
                              selectedTrainingTrackingAssignment.selectedTemplateId,
                              selectedTrainingTrackingAssignment.templateTitle,
                            ) }}
                            <span v-if="selectedTrainingTrackingAssignment.assignedAt">
                              | Assigned {{ selectedTrainingTrackingAssignment.assignedAt }}
                            </span>
                          </p>
                        </div>
                        <span
                          class="business-assign-templates__status"
                          :class="`is-progress-${resolveTrainingTrackingProgressTone(selectedTrainingTrackingAssignment.progressStatus)}`"
                        >
                          {{ selectedTrainingTrackingAssignment.progressStatus }}
                        </span>
                      </div>

                      <div class="business-assign-templates__tracking-summary">
                        <article class="business-assign-templates__tracking-stat">
                          <span>Overall Progress</span>
                          <strong>{{ selectedTrainingTrackingAssignment.overallProgress.percent }}%</strong>
                          <small>
                            {{ selectedTrainingTrackingAssignment.overallProgress.completedSkills }}/{{ selectedTrainingTrackingAssignment.overallProgress.totalSkills || 0 }} skills complete
                          </small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Total Score</span>
                          <strong>{{ selectedTrainingTrackingAssignment.scoreSummary.totalScore }}/{{ selectedTrainingTrackingAssignment.scoreSummary.maxScore || 0 }}</strong>
                          <small>
                            {{
                              selectedTrainingTrackingAssignment.scoreSummary.gradedSkills
                                ? `${selectedTrainingTrackingAssignment.scoreSummary.gradedSkills}/${selectedTrainingTrackingAssignment.scoreSummary.totalSkills || 0} skills graded - Avg ${selectedTrainingTrackingAssignment.scoreSummary.averageScore}/5`
                                : 'No skill grades saved yet'
                            }}
                          </small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Training Categories</span>
                          <strong>{{ selectedTrainingTrackingAssignment.templateCategories.length }}</strong>
                          <small>Saved from the assigned training template</small>
                        </article>
                        <article class="business-assign-templates__tracking-stat">
                          <span>Position</span>
                          <strong>{{ selectedTrainingTrackingAssignment.role }}</strong>
                          <small>{{ selectedTrainingTrackingAssignment.stage }}</small>
                        </article>
                      </div>

                      <div
                        v-if="selectedTrainingTrackingAssignment.overallProgress.totalSkills"
                        class="business-assign-templates__tracking-progress-bar"
                        aria-hidden="true"
                      >
                        <span
                          class="business-assign-templates__tracking-progress-fill"
                          :style="{ width: `${selectedTrainingTrackingAssignment.overallProgress.percent}%` }"
                        />
                      </div>

                      <div class="business-assign-templates__tracking-categories">
                        <article
                          v-for="category in selectedTrainingTrackingAssignment.templateCategories"
                          :key="`${selectedTrainingTrackingAssignment.id}-${category.id}`"
                          class="business-assign-templates__tracking-category"
                          :class="{ 'is-selected': isTrainingTrackingCategorySelected(category.id) }"
                        >
                          <button
                            type="button"
                            class="business-assign-templates__tracking-category-head business-assign-templates__tracking-category-toggle"
                            :class="{ 'is-selected': isTrainingTrackingCategorySelected(category.id) }"
                            :aria-expanded="isTrainingTrackingCategorySelected(category.id) ? 'true' : 'false'"
                            @click="toggleTrainingTrackingCategorySelection(category.id)"
                          >
                            <div>
                              <strong>{{ category.title || 'Untitled category' }}</strong>
                              <span>
                                {{ category.progress.completedSkills }}/{{ category.progress.totalSkills || 0 }} skills completed
                                | Score {{ category.score.totalScore }}/{{ category.score.maxScore || 0 }}
                              </span>
                            </div>
                            <div class="business-assign-templates__tracking-category-meta">
                              <strong>{{ category.progress.percent }}%</strong>
                              <small>{{ category.score.gradedSkills }}/{{ category.progress.totalSkills || 0 }} graded</small>
                            </div>
                          </button>

                          <template v-if="isTrainingTrackingCategorySelected(category.id)">
                            <div
                              v-if="category.progress.totalSkills"
                              class="business-assign-templates__tracking-progress-bar business-assign-templates__tracking-progress-bar--category"
                              aria-hidden="true"
                            >
                              <span
                                class="business-assign-templates__tracking-progress-fill"
                                :style="{ width: `${category.progress.percent}%` }"
                              />
                            </div>

                            <div v-if="category.skills.length" class="business-assign-templates__tracking-skills">
                            <div
                              v-for="skill in category.skills"
                              :key="`${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}`"
                              class="business-assign-templates__tracking-skill"
                              :class="{
                                'is-complete': skill.completed,
                                'is-selected': isTrainingTrackingSkillSelected(selectedTrainingTrackingAssignment.id, category.id, skill.id),
                              }"
                              @click="toggleTrainingTrackingSkillSelection(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                            >
                              <div class="business-assign-templates__tracking-skill-check">
                                <input
                                  type="checkbox"
                                  :checked="skill.completed"
                                  :disabled="!canEditTrainingAssignments || isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                                  @click.stop
                                  @change="toggleTrainingAssignmentSkillCompletion(
                                    selectedTrainingTrackingAssignment.id,
                                    category.id,
                                    skill.id,
                                    $event.target.checked,
                                    )"
                                  />
                                </div>
                                <div class="business-assign-templates__tracking-skill-copy">
                                  <strong>{{ skill.name || 'Untitled skill' }}</strong>
                                  <span v-if="skill.description">{{ skill.description }}</span>
                                  <small>
                                    {{
                                      isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)
                                        ? 'Saving...'
                                        : skill.completed
                                          ? skill.grade
                                            ? `Completed - Rated ${skill.grade}/5`
                                            : 'Completed - Waiting for grade'
                                          : 'Pending'
                                    }}
                                  </small>
                                  <div
                                    v-if="isTrainingTrackingSkillSelected(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                                    class="business-assign-templates__tracking-grade"
                                    @click.stop
                                  >
                                    <span class="business-assign-templates__tracking-grade-label">Skill Grade</span>
                                    <div class="business-assign-templates__tracking-grade-scale">
                                      <label
                                        v-for="gradeOption in TRAINING_TRACKING_GRADE_SCALE"
                                        :key="`${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}-${gradeOption}`"
                                        class="business-assign-templates__tracking-grade-option"
                                        @click.stop
                                      >
                                        <input
                                          type="radio"
                                          :name="`training-grade-${selectedTrainingTrackingAssignment.id}-${category.id}-${skill.id}`"
                                          :checked="skill.grade === gradeOption"
                                          :disabled="!canEditTrainingAssignments || isTrainingTrackingSkillSaving(selectedTrainingTrackingAssignment.id, category.id, skill.id)"
                                          @click.stop
                                          @change="setTrainingAssignmentSkillGrade(
                                            selectedTrainingTrackingAssignment.id,
                                            category.id,
                                            skill.id,
                                            gradeOption,
                                          )"
                                        />
                                        <span>{{ gradeOption }}</span>
                                      </label>
                                    </div>
                                    <small class="business-assign-templates__tracking-grade-note">
                                      {{
                                        skill.grade
                                          ? `${skill.grade}/5 selected for this skill.`
                                          : 'Choose a score from 1 to 5 for this skill.'
                                      }}
                                    </small>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div v-else class="business-assign-templates__empty business-assign-templates__empty--compact">
                              <strong>No skills listed in this category yet</strong>
                              <p>Edit the saved training template if you want to add more skills for future assignments.</p>
                            </div>

                            <div
                              v-if="category.canAddRemark"
                              class="business-assign-templates__tracking-remark"
                            >
                              <div class="business-assign-templates__tracking-remark-head">
                                <div>
                                  <strong>Category Remark</strong>
                                  <span>
                                    {{
                                      category.isFullyGraded
                                        ? 'All skills are checked and graded. Add your final remark for this category.'
                                        : 'This remark is unlocked because all skills are checked. Finish grading each skill, then save your final category remark.'
                                    }}
                                  </span>
                                </div>
                                <span
                                  v-if="category.remarkedAt"
                                  class="business-assign-templates__tracking-remark-time"
                                >
                                  Saved {{ formatBusinessInterviewDateTime(category.remarkedAt) }}
                                </span>
                              </div>
                              <textarea
                                class="business-assign-templates__tracking-remark-input"
                                rows="4"
                                :disabled="!canEditTrainingAssignments || isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)"
                                :value="getTrainingTrackingCategoryRemarkDraft(selectedTrainingTrackingAssignment.id, category)"
                                placeholder="Add your training remark for this category..."
                                @input="setTrainingTrackingCategoryRemarkDraft(selectedTrainingTrackingAssignment.id, category.id, $event.target.value)"
                              />
                              <div class="business-assign-templates__tracking-remark-actions">
                                <small>
                                  {{
                                    isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)
                                      ? 'Saving category remark...'
                                      : category.hasRemark
                                        ? 'A saved remark is required before you can complete the full training record.'
                                        : 'Save a remark for this category after reviewing every skill.'
                                  }}
                                </small>
                                <button
                                  type="button"
                                  class="business-assign-templates__action"
                                  :disabled="!canEditTrainingAssignments || isTrainingTrackingCategorySaving(selectedTrainingTrackingAssignment.id, category.id)"
                                  @click="saveTrainingTrackingCategoryRemark(selectedTrainingTrackingAssignment.id, category.id)"
                                >
                                  Save Remark
                                </button>
                              </div>
                            </div>
                            <div
                              v-else
                              class="business-assign-templates__tracking-remark business-assign-templates__tracking-remark--locked"
                            >
                              <strong>Category remark locked</strong>
                              <p>This remark field will appear only after all skills in this category are checked as completed.</p>
                            </div>
                          </template>
                        </article>
                      </div>

                      <div class="business-assign-templates__tracking-footer">
                        <div
                          v-if="selectedTrainingTrackingAssignment.trainingCompletedAt"
                          class="business-assign-templates__tracking-complete business-assign-templates__tracking-complete--done"
                        >
                          <strong>Training monitoring completed</strong>
                          <p>
                            Completed {{ formatBusinessInterviewDateTime(selectedTrainingTrackingAssignment.trainingCompletedAt) }}
                            <span v-if="selectedTrainingTrackingAssignment.trainingCompletedByName">
                              by {{ selectedTrainingTrackingAssignment.trainingCompletedByName }}
                            </span>.
                          </p>
                        </div>
                        <div
                          v-else-if="selectedTrainingTrackingAssignment.canCompleteTraining"
                          class="business-assign-templates__tracking-complete"
                        >
                          <div>
                            <strong>Ready to complete this training record</strong>
                            <p>All categories are checked, every skill has a 1-5 grade, and each category already has a saved remark.</p>
                          </div>
                          <button
                            type="button"
                            class="business-assign-templates__action"
                            :disabled="!canEditTrainingAssignments || isTrainingTrackingAssignmentCompleting(selectedTrainingTrackingAssignment.id)"
                            @click="completeTrainingTrackingAssignment(selectedTrainingTrackingAssignment.id)"
                          >
                            {{ isTrainingTrackingAssignmentCompleting(selectedTrainingTrackingAssignment.id) ? 'Completing...' : 'Complete Training' }}
                          </button>
                        </div>
                        <div
                          v-else
                          class="business-assign-templates__tracking-complete business-assign-templates__tracking-complete--pending"
                        >
                          <strong>Finish monitoring each training category first</strong>
                          <p>Check all skills, add a 1-5 grade for every completed skill, and save a remark for each category to unlock the final complete training action.</p>
                        </div>
                      </div>
                      </section>
                    </section>
                  </div>
                  <div v-else class="business-assign-templates__empty">
                    <strong>No tracked applicants yet</strong>
                    <p>Assigned applicants will appear here so you can monitor skills and mark completed training checks.</p>
                  </div>
                </article>
              </div>
            </section>
</template>
