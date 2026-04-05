import { useEffect, useMemo, useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./main_landing.css";
import heroBackgroundAlt from "@/assets/better03.png";
import heroBackground from "@/assets/better02.jpg";
import heroBackgroundPrimary from "@/assets/bettert01.png";
import logoPwd from "@/assets/logo-pwd.png";
import pwdWordmark from "@/assets/pwdlogo.png";

const heroSlides = [heroBackgroundPrimary, heroBackground, heroBackgroundAlt];

const categories = [
  { title: "Development & IT", jobs: "16 jobs", icon: "bi bi-code-slash" },
  { title: "Marketing & Sales", jobs: "8 jobs", icon: "bi bi-megaphone" },
  { title: "Design & Creative", jobs: "13 jobs", icon: "bi bi-palette" },
  { title: "Customer Service", jobs: "8 jobs", icon: "bi bi-headset" },
  { title: "Administration", jobs: "11 jobs", icon: "bi bi-briefcase" },
  { title: "Education", jobs: "7 jobs", icon: "bi bi-book" },
  { title: "Retail & Sales", jobs: "10 jobs", icon: "bi bi-bag" },
  { title: "Healthcare Support", jobs: "6 jobs", icon: "bi bi-heart-pulse" },
];

const featuredJobs = [
  {
    title: "Administrative Assistant",
    company: "City Public Employment Office",
    location: "Dasmarinas, Cavite",
    type: "Full-time",
    setup: "On-site",
    disabilityFit: "Deaf and Hard of Hearing Individuals",
    description:
      "Provide front-desk support, file document requests, and help coordinate applicant records with a structured daily workflow.",
  },
  {
    title: "Data Encoder",
    company: "Inclusive Business Hub",
    location: "Hybrid setup",
    type: "Contract",
    setup: "Hybrid",
    disabilityFit: "Visually Impaired",
    description:
      "Maintain digital records, verify encoded data, and support reporting tasks with clear process documentation.",
  },
  {
    title: "Customer Support Associate",
    company: "Community Access Center",
    location: "Imus, Cavite",
    type: "Full-time",
    setup: "On-site",
    disabilityFit: "Speech Impairment",
    description:
      "Respond to client concerns, manage service logs, and guide users through accessible support channels.",
  },
];

const steps = [
  {
    count: "01",
    title: "Create your profile",
    description: "Set your disability-friendly preferences and create a job-ready account.",
  },
  {
    count: "02",
    title: "Explore inclusive jobs",
    description: "Browse opportunities from employers looking for accessible, inclusive talent.",
  },
  {
    count: "03",
    title: "Apply and connect",
    description: "Track your progress, employer connections, and upcoming opportunities with ease.",
  },
];

export default function MainLandingTsx(): React.JSX.Element {
  const [scrollY, setScrollY] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isPolicyMenuOpen, setIsPolicyMenuOpen] = useState(false);
  const [selectedFeaturedJobIndex, setSelectedFeaturedJobIndex] = useState(0);

  const selectedJob = useMemo(
    () => featuredJobs[selectedFeaturedJobIndex] ?? featuredJobs[0],
    [selectedFeaturedJobIndex],
  );

  useEffect(() => {
    const lock = (locked: boolean) => {
      document.documentElement.classList.toggle("landing-loading-lock", locked);
      document.body.classList.toggle("landing-loading-lock", locked);
      document.body.style.overflow = locked ? "hidden" : "";
    };

    lock(true);
    const timeout = window.setTimeout(() => {
      setIsPageLoading(false);
      lock(false);
    }, 1300);

    return () => {
      window.clearTimeout(timeout);
      lock(false);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY || 0);
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".nav-policy")) return;
      setIsPolicyMenuOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const isNavScrolled = scrollY > 24;
  const currentYear = new Date().getFullYear();

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-x-clip text-[#f4f1e8] transition-colors duration-500 ease-out ${
        isPageLoading ? "bg-[#061810]" : "bg-[#f5f4ef]"
      }`}
    >
      {isPageLoading && (
        <div className="loading-screen">
          <div className="loading-screen__aurora loading-screen__aurora--one" />
          <div className="loading-screen__aurora loading-screen__aurora--two" />
          <div className="loading-screen__grid" />
          <div className="loading-screen__panel">
            <div className="loading-screen__logo-shell">
              <img className="loading-screen__logo" src={logoPwd} alt="PWD logo" />
            </div>
            <img className="loading-screen__wordmark" src={pwdWordmark} alt="PWD Platform" />
            <div className="loading-screen__dots" aria-hidden="true">
              <span className="loading-screen__dot" />
              <span className="loading-screen__dot" />
              <span className="loading-screen__dot" />
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-1 flex-col transition-opacity duration-700 ease-out ${isPageLoading ? "opacity-0" : "opacity-100"}`}>
        <header
          className={`relative z-10 border-b border-[#dce6e0] shadow-[0_10px_24px_rgba(23,35,29,0.06)] transition-[padding,transform] duration-300 ${
            isNavScrolled ? "bg-white pt-3" : "bg-white pt-5"
          }`}
        >
          <nav className="relative mx-auto grid w-full max-w-[1180px] grid-cols-[auto_1fr_auto] items-center gap-5 px-5 py-4 max-[900px]:grid-cols-1 max-[900px]:justify-items-center max-[900px]:gap-3">
            <a className="inline-flex items-center gap-1.5" href="#home">
              <img
                className="h-[2.7rem] w-[2.7rem] shrink-0 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.26)]"
                src={logoPwd}
                alt="PWD logo"
              />
              <img
                className="h-[2.4rem] w-auto shrink object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                src={pwdWordmark}
                alt="PWD Platform"
              />
            </a>

            <div className="inline-flex items-center justify-center gap-6 justify-self-center text-[#17231d] font-semibold max-[900px]:flex-wrap">
              <a className="transition duration-200 hover:-translate-y-0.5 hover:opacity-85" href="#home">Home</a>
              <a className="transition duration-200 hover:-translate-y-0.5 hover:opacity-85" href="#featured-jobs">Jobs</a>
              <a className="transition duration-200 hover:-translate-y-0.5 hover:opacity-85" href="#features">Features</a>
              <a className="transition duration-200 hover:-translate-y-0.5 hover:opacity-85" href="#contact-us">About Us</a>
              <div className="nav-policy relative">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-2 transition duration-200 hover:-translate-y-0.5 hover:opacity-85"
                  onClick={() => setIsPolicyMenuOpen((value) => !value)}
                >
                  <span>Policy</span>
                  <i className={`bi bi-chevron-down text-[0.76rem] transition-transform duration-200 ${isPolicyMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {isPolicyMenuOpen && (
                  <div className={`nav-policy__menu ${isNavScrolled ? "nav-policy__menu--scrolled" : ""}`}>
                    <a className="nav-policy__item" href="#home">Privacy Policy</a>
                    <a className="nav-policy__item" href="#home">Terms and Conditions</a>
                    <a className="nav-policy__item" href="#home">Accessibility Policy</a>
                  </div>
                )}
              </div>
            </div>

            <a
              className="inline-flex items-center justify-center justify-self-end rounded-[0.95rem] border border-[#d7e2db] bg-white px-[1.05rem] py-[0.62rem] text-[0.92rem] font-semibold tracking-[0.01em] text-[#17231d] transition duration-300 hover:-translate-y-0.5 hover:border-[#c5d4ca] hover:bg-[#f7faf8] max-[900px]:justify-self-center max-[640px]:w-full"
              href="/login"
            >
              <span>Login</span>
            </a>
          </nav>
        </header>

        <main className="relative z-[1] mx-auto flex flex-1 flex-col max-w-[1180px] px-4 pb-0 pt-12 sm:px-[clamp(1rem,3vw,2rem)] max-[640px]:px-[0.8rem]">
          <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[clamp(36rem,78svh,52rem)] w-screen -translate-x-1/2 overflow-hidden max-[900px]:h-[clamp(32rem,72svh,44rem)]" aria-hidden="true">
            <div className="absolute -inset-[8%] will-change-transform" style={{ transform: `translate3d(0, ${scrollY * 0.18}px, 0)` }}>
              {heroSlides.map((slide, index) => (
                <img
                  key={slide}
                  src={slide}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover saturate-[0.82] brightness-[0.55] hue-rotate-[24deg] transition-opacity duration-[1200ms] ease-out ${
                    currentSlide === index ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(245,250,247,0.16)_0%,rgba(15,56,35,0.36)_28%,rgba(12,44,28,0.44)_60%,rgba(7,31,20,0.56)_100%),linear-gradient(180deg,rgba(240,248,243,0.12)_0%,rgba(10,42,27,0.26)_36%,rgba(5,25,16,0.62)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
          </div>

          <section
            id="home"
            className="relative -mt-12 w-screen pb-35 pt-[calc(6rem+clamp(1.2rem,2.5vw,2rem))] [margin-left:calc(50%-50vw)] [margin-right:calc(50%-50vw)] max-[900px]:pb-18 max-[900px]:pt-6"
          >
            <div className="relative z-[1] mx-auto grid w-full max-w-[1380px] grid-cols-[minmax(340px,700px)_minmax(300px,560px)] items-start gap-[clamp(2rem,4vw,4rem)] px-[clamp(1.25rem,3vw,3rem)] pt-[clamp(3.5rem,5.8vw,5.5rem)] max-[900px]:grid-cols-1 max-[900px]:pt-10 max-[640px]:px-4">
              <div
                className="relative z-[1] -mt-20 w-full max-w-[820px] overflow-visible self-start will-change-transform max-[900px]:-mt-8"
                style={{ transform: `translate3d(0, ${scrollY * 0.1}px, 0)` }}
              >
                <p className="mb-4 text-[0.92rem] font-semibold uppercase tracking-[0.22em] text-[#f3be79] max-[640px]:text-[0.8rem]">
                  Inclusive Employment Platform
                </p>
                <h1 className="m-0 max-w-[13ch] text-[clamp(2rem,3.9vw,3.75rem)] font-bold leading-[1] tracking-[-0.035em] text-[#f7f3ea] max-[640px]:max-w-[12ch] max-[640px]:text-[clamp(1.65rem,6.2vw,2.25rem)]">
                  Employment&nbsp;Assistant&nbsp;For <span className="hero-title-accent">Persons&nbsp;with&nbsp;a&nbsp;Disability</span> Powered&nbsp;by&nbsp;Decision Support&nbsp;System
                </h1>
                <p className="mt-5 max-w-[48rem] text-[clamp(1rem,1.1vw,1.05rem)] leading-[1.7] text-[rgba(244,241,232,0.82)] max-[640px]:max-w-[32ch] max-[640px]:text-[0.96rem]">
                  Helping persons with disabilities discover meaningful work, grow confidently, and succeed without barriers.
                </p>

                <div className="hero-search-shell">
                  <form className="hero-search" action="#featured-jobs">
                    <label className="hero-search__field hero-search__field--input">
                      <div className="hero-search__control">
                        <span className="hero-search__icon" aria-hidden="true">
                          <i className="bi bi-search" />
                        </span>
                        <input className="hero-search__input" type="text" placeholder="What opportunities are you looking for?" />
                      </div>
                    </label>

                    <button className="hero-search__button" type="button">Search</button>
                  </form>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="landing-primary-button" href="/login">Start Journey</a>
                  <a className="landing-secondary-button" href="#featured-jobs">Browse Featured Jobs</a>
                </div>
              </div>
            </div>
          </section>

          <section className="sections-shell">
            <section id="features" className="section-categories__panel">
              <div className="section-categories__header">
                <div>
                  <p className="section-shell__eyebrow">Popular Categories</p>
                  <h2>Explore accessible job paths</h2>
                </div>
              </div>

              <div className="section-categories__grid">
                {categories.map((category) => (
                  <article key={category.title} className="section-categories__card">
                    <span className="section-categories__icon">
                      <i className={category.icon} />
                    </span>
                    <h3>{category.title}</h3>
                    <p>{category.jobs}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="featured-jobs" className="section-featured__panel">
              <div className="section-featured__header">
                <div>
                  <p className="section-shell__eyebrow">Featured Jobs</p>
                  <h2>Continue exploring inclusive jobs</h2>
                </div>
              </div>

              <div className="section-featured__layout">
                <div className="featured-jobs-list">
                  {featuredJobs.map((job, index) => (
                    <button
                      key={`${job.title}-${job.company}`}
                      type="button"
                      className={`featured-job-card ${selectedFeaturedJobIndex === index ? "featured-job-card--active" : ""}`}
                      onClick={() => setSelectedFeaturedJobIndex(index)}
                    >
                      <strong>{job.title}</strong>
                      <span>{job.company}</span>
                    </button>
                  ))}
                </div>

                <article className="featured-job-details">
                  <div className="featured-job-details__top">
                    <div>
                      <h3>{selectedJob.title}</h3>
                      <p>{selectedJob.company}</p>
                    </div>
                    <span>{selectedJob.type}</span>
                  </div>

                  <div className="featured-job-details__chips">
                    <span>{selectedJob.location}</span>
                    <span>{selectedJob.setup}</span>
                    <span>{selectedJob.disabilityFit}</span>
                  </div>

                  <p className="featured-job-details__copy">{selectedJob.description}</p>

                  <div className="featured-job-details__actions">
                    <a href="/login">Apply Now</a>
                    <a className="featured-job-details__ghost" href="/login">Save</a>
                  </div>
                </article>
              </div>
            </section>

            <section className="section-steps__panel">
              <div className="section-steps__header">
                <div>
                  <p className="section-shell__eyebrow">How It Works</p>
                  <h2>Three guided steps to get started</h2>
                </div>
              </div>

              <div className="section-steps__grid">
                {steps.map((step) => (
                  <article key={step.count} className="section-steps__card">
                    <div className="section-steps__topline">{step.count}</div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="contact-us" className="section-contact__panel">
              <div className="section-contact__header">
                <div>
                  <p className="section-shell__eyebrow">Contact Us</p>
                  <h2>Employer connections and accessible support</h2>
                </div>
                <a className="section-contact__link" href="/login">Start Journey</a>
              </div>

              <div className="section-contact__layout">
                <div className="section-contact__details">
                  <article className="section-contact__card">
                    <span className="section-contact__card-icon">
                      <i className="bi bi-geo-alt-fill" />
                    </span>
                    <div>
                      <h3>Visit the City Support Desk</h3>
                      <p>City of Dasmarinas, Cavite. Accessible employer and applicant assistance available.</p>
                    </div>
                  </article>

                  <article className="section-contact__card">
                    <span className="section-contact__card-icon">
                      <i className="bi bi-envelope-fill" />
                    </span>
                    <div>
                      <h3>Reach our team</h3>
                      <p>Connect for profile guidance, employer coordination, and inclusive job support.</p>
                    </div>
                  </article>
                </div>

                <div className="section-contact__map-shell">
                  <div className="section-contact__map-placeholder">
                    <i className="bi bi-map" />
                    <span>Map area</span>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </main>

        <footer className="landing-footer">
          <div className="landing-footer__glow landing-footer__glow--one" />
          <div className="landing-footer__glow landing-footer__glow--two" />

          <div className="landing-footer__inner">
            <div>
              <div className="landing-footer__brand-top">
                <img className="landing-footer__logo" src={logoPwd} alt="PWD logo" />
                <div>
                  <p className="landing-footer__eyebrow">Inclusive Platform</p>
                  <h2 className="landing-footer__title">PWD Employment Assistant</h2>
                </div>
              </div>
              <p className="landing-footer__copy">
                Helping applicants discover opportunities, build confidence, and connect with employers through an accessible employment platform.
              </p>
            </div>

            <div className="landing-footer__links">
              <div className="landing-footer__column">
                <p className="landing-footer__heading">Explore</p>
                <a href="#home">Home</a>
                <a href="#featured-jobs">Jobs</a>
                <a href="#features">Features</a>
              </div>
              <div className="landing-footer__column">
                <p className="landing-footer__heading">Support</p>
                <a href="#contact-us">Contact Us</a>
                <a href="/login">Login</a>
                <a href="/login">Start Journey</a>
              </div>
              <div className="landing-footer__column">
                <p className="landing-footer__heading">Location</p>
                <span>Dasmarinas, Cavite</span>
                <span>Accessible employment assistance</span>
              </div>
            </div>
          </div>

          <div className="landing-footer__bottom">
            <p>&copy; {currentYear} PWD Employment Assistant</p>
            <p>Built for inclusive jobs, employer connections, and accessible opportunities.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
