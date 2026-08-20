import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Heart, Sparkles, Target, Users } from 'lucide-react';
import { getFacultyCoordinator, getSiteSettings } from '../../services/applicationService';
import { getPositionHolders } from '../../services/positionService';
import type { FacultyCoordinator, PositionRecord, UserProfile } from '../../types';

type CommitteeGroup = {
  position: PositionRecord;
  users: UserProfile[];
};

const fallbackDescription =
  'SAInT (Student Association of Information Technology, R.S.C.O.E.) is a student-run association that organises events, seminars, and workshops to support students\' academic and social development. Operated by students with teacher support, elected coordinators manage activities that enhance learning and community contribution.';

export default function AboutPage() {
  const [aboutText, setAboutText] = useState('');
  const [committee, setCommittee] = useState<CommitteeGroup[]>([]);
  const [faculty, setFaculty] = useState<FacultyCoordinator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSiteSettings(), getPositionHolders(), getFacultyCoordinator()])
      .then(([settings, positions, coordinator]) => {
        setAboutText(typeof settings.aboutText === 'string' ? settings.aboutText : '');
        setCommittee(positions as CommitteeGroup[]);
        setFaculty(coordinator as FacultyCoordinator | null);
      })
      .finally(() => setLoading(false));
  }, []);

  const committeeMembers = committee.flatMap(({ position, users }) =>
    users.map((user) => ({ position, user }))
  );
  const openPositions = committee.filter(({ users }) => users.length === 0).map(({ position }) => position);
  const description = aboutText.trim() || fallbackDescription;

  return (
    <div className="pb-8">
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-blue-700 bg-blue-100/80 border border-blue-200 mb-6">
            <Sparkles className="w-4 h-4" /> Student Association of Information Technology
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950 mb-6">Built by students, for students.</h1>
          <p className="text-lg sm:text-xl leading-relaxed text-slate-700 max-w-3xl mx-auto">{description}</p>
        </div>
      </section>
        {/* Objectives & Outcomes: shown inline under the main text and above the three feature cards */}
        <section className="py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="grid md:grid-cols-2 gap-4 p-6 text-slate-700">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Objectives</h4>
                  </div>
                </div>
                <ul className="text-sm leading-relaxed list-disc list-inside space-y-2 text-slate-700">
                  <li>To organize technical events (workshops, seminars, hackathons) for skill enhancement.</li>
                  <li>To promote leadership, teamwork, and responsibility among students.</li>
                  <li>To bridge the gap between academics and industry through expert sessions.</li>
                  <li>To encourage innovation, creativity, and problem-solving in IT students.</li>
                  <li>To engage in social and community development activities.</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Outcomes</h4>
                  </div>
                </div>
                <ul className="text-sm leading-relaxed list-disc list-inside space-y-2 text-slate-700">
                    <li>Enhanced academic performance and professional readiness.</li>
                    <li>Development of socially responsible and well-rounded individuals.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-5">
          {[
            { icon: Target, title: 'Our Mission', text: 'Create meaningful opportunities for IT students to learn, lead, and contribute.' },
            { icon: Heart, title: 'Our Culture', text: 'A welcoming student community built on curiosity, teamwork, and mutual support.' },
            { icon: Award, title: 'Our Impact', text: 'Events, workshops, and projects that turn classroom knowledge into real experience.' },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="card !p-6 bg-white/85 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-5"><Icon className="w-5 h-5" /></div>
              <h2 className="font-bold text-lg text-slate-950 mb-2">{title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      

      <section className="py-16" id="committee">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-2">The People Behind SAInT</p>
            <h2 className="section-title mb-3">Core Committee</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">The core committee is the driving force behind SAInT’s events, initiatives, and student engagement, bringing together leadership, creativity, and responsibility across the department.</p>
          </div>

          {loading ? (
            <div className="card text-center py-14 text-slate-500">Loading the committee…</div>
          ) : committeeMembers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
              {committeeMembers.map(({ position, user }) => (
                <article key={`${position.id}-${user.uid}`} className="text-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover ring-4 ring-blue-100 transition-transform duration-300 hover:scale-105" />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-700 text-white flex items-center justify-center text-3xl font-bold ring-4 ring-blue-100 transition-transform duration-300 hover:scale-105">
                      {user.displayName?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}
                  <h3 className="font-bold text-slate-950">{user.displayName}</h3>
                  <p className="text-sm text-blue-600 font-medium mt-1">{position.title}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="card text-center py-14">
              <Users className="w-11 h-11 text-blue-300 mx-auto mb-4" />
              <p className="font-semibold text-slate-800">The core committee will be announced soon.</p>
              <p className="text-sm text-slate-500 mt-1">Set positions and assign members from the dashboard to display them here.</p>
            </div>
          )}

          {openPositions.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {openPositions.map((position) => <span key={position.id} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white/75 text-slate-500">Open: {position.title}</span>)}
            </div>
          )}
        </div>
      </section>

      {faculty && (
        <section className="py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl p-8 text-white bg-gradient-to-br from-blue-600 to-indigo-900 shadow-xl">
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden ring-4 ring-white/20">
                  <img src="/images/faculty-coordinator.jpg" alt="Faculty Coordinator" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-2">Faculty Coordinator</p>
                  <h2 className="text-2xl font-bold">{faculty.name}</h2>
                  <p className="text-blue-100 mt-1">{faculty.designation}</p>
                  {faculty.email && <a className="inline-block text-sm text-white/90 mt-3 hover:underline" href={`mailto:${faculty.email}`}>{faculty.email}</a>}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="pt-14 pb-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-950 mb-3">Ready to grow with us?</h2>
          <p className="text-slate-600 mb-7">Bring your skills, curiosity, and ideas to the SAInT community.</p>
          <Link to="/apply" className="btn-primary"><ArrowRight className="w-4 h-4" /> Apply to SAInT</Link>
        </div>
      </section>
    </div>
  );
}
