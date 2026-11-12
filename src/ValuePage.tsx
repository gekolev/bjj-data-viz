import { Activity, ArrowLeft, ArrowRight, Building2, CalendarCheck, Check, Download, Heart, Megaphone, ShieldCheck, Sparkles, Users } from 'lucide-react'
import './ValuePage.css'
import './ValueOwner.css'

const studentBenefits = [
  ['Makes progress visible', 'Students see their sessions and mat hours even when technical improvement is difficult to feel.'],
  ['Builds motivation', 'Accumulated effort reminds students that a difficult month does not erase how far they have come.'],
  ['Creates accountability', 'Real attendance patterns show whether someone is training as consistently as they think.'],
  ['Preserves the journey', 'Classes, coaches, academies, belt milestones, and years of training become a personal archive.'],
  ['Celebrates commitment', 'Year Wrapped turns ordinary attendance into a recap students can save and share.'],
  ['Encourages reflection', 'Students spot the days, classes, and routines that help them keep showing up.'],
]

const ownerBenefits = [
  { icon: Heart, title: 'Support student retention', bullets: ['Visible investment gives students another reason to continue during plateaus.', 'Training feels like an ongoing journey, not disconnected classes.', 'Long-term progress is easier to appreciate before motivation drops.'] },
  { icon: Users, title: 'Deepen the academy connection', bullets: ['Coach and academy breakdowns show who helped shape the journey.', 'Rank milestones sit beside the classes that led to them.', 'Students build a stronger emotional record of their time at the gym.'] },
  { icon: Megaphone, title: 'Create organic word of mouth', bullets: ['Wrapped cards give students a natural reason to talk about training.', 'Recaps can be shared with teammates, friends, and social audiences.', 'Student pride becomes positive visibility for the academy.'] },
  { icon: Sparkles, title: 'Add value without adding admin', bullets: ['Gymdesk history can be imported instead of entered from scratch.', 'Students manage their own accounts, imports, and manual logs.', 'The gym only shares the app—staff get no new attendance workflow.'] },
]

const reasons = [
  'It gives students more value from attendance data the gym already records.',
  'It supports consistency without ranking students against each other.',
  'It helps students through the common “I am not improving” plateau.',
  'It celebrates the gym, coaches, and promotion journey in a personal way.',
  'It generates student-created social content through Year Wrapped.',
  'It serves dedicated hobbyists—the members most invested in staying long term.',
  'It is simple to try: import Gymdesk history, explore, and keep logging.',
  'It complements coaching; it does not claim to measure skill or replace instruction.',
]

const talkingPoints = [
  'Mat Metrics makes invisible effort visible.',
  'Students need evidence that their work is adding up—not just more statistics.',
  'The app turns attendance history into motivation, reflection, and recognition.',
  'When students value their journey, they have another reason to stay connected to it.',
  'The academy becomes part of the story through coaches, locations, classes, and ranks.',
  'There is no leaderboard; the focus is each student’s personal commitment.',
]

export default function ValuePage() {
  return <div className="value-page">
    <header className="value-header"><a className="value-brand" href="/" aria-label="Mat Metrics home"><span><Activity size={18} /></span>mat<strong>metrics</strong><i>.</i></a><a className="value-back" href="/"><ArrowLeft size={15} /> Back to the app</a></header>
    <main>
      <section className="value-hero value-owner-hero"><div className="value-hero-copy"><span className="value-kicker"><Building2 size={14} /> A conversation for gym owners</span><h1>Help students see why<br /><em>showing up matters.</em></h1><p>Mat Metrics turns attendance into motivation. It helps students recognize their consistency, remember their journey, and feel more connected to the work they put in at your academy.</p><a href="#why-promote"><span>Why promote it</span><ArrowRight size={17} /></a></div><aside className="value-hero-note value-owner-summary"><span>THE SHORT VERSION</span><h2>More visible progress.<br />More meaningful attendance.<br />A stronger connection to training.</h2><ul><li><Check size={15} /> Motivation for students</li><li><Check size={15} /> Retention support for the gym</li><li><Check size={15} /> No extra work for coaches</li></ul></aside></section>

      <section className="value-thesis value-owner-thesis"><span>THE PROBLEM IT SOLVES</span><h2>Students remember promotions.<br />They forget the <em>hundreds of classes</em> behind them.</h2><ul><li>“I do not feel like I am getting better.”</li><li>“I have not trained enough lately.”</li><li>“How much time have I spent on the mats?”</li><li>“I wish I could see my whole journey.”</li></ul><p>Mat Metrics answers those questions with the student’s own history—not comparisons, rankings, or vague encouragement.</p></section>

      <section className="value-benefits"><div className="value-section-heading"><span>VALUE FOR STUDENTS</span><h2>What students get from it.</h2><p>Practical and emotional benefits they can understand immediately.</p></div><div className="value-bullet-grid">{studentBenefits.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

      <section className="value-owner-benefits"><div className="value-section-heading"><span>VALUE FOR THE ACADEMY</span><h2>Why a gym owner should care.</h2></div><div className="value-owner-grid">{ownerBenefits.map(({ icon: Icon, title, bullets }) => <article key={title}><div className="value-owner-icon"><Icon size={22} /></div><h3>{title}</h3><ul>{bullets.map(bullet => <li key={bullet}><Check size={14} /><span>{bullet}</span></li>)}</ul></article>)}</div></section>

      <section className="value-promote" id="why-promote"><div className="value-promote-intro"><span>WHY PROMOTE MAT METRICS?</span><h2>Eight reasons to share it with students.</h2><p>The strongest case is not “here is another dashboard.” It is “here is a simple way to help students value their own journey.”</p></div><ol>{reasons.map((point, index) => <li key={point}><span>{String(index + 1).padStart(2, '0')}</span><p>{point}</p></li>)}</ol></section>

      <section className="value-how-it-works"><div className="value-section-heading"><span>LOW-FRICTION FOR EVERYONE</span><h2>Easy for the gym to share.<br />Easy for students to start.</h2></div><div className="value-steps"><article><span><Megaphone size={19} /></span><strong>1. The gym shares Mat Metrics</strong><p>Add it to a welcome email, member group, newsletter, or end-of-year message.</p></article><article><span><Download size={19} /></span><strong>2. Students import their history</strong><p>Gymdesk attendance and rank records become a dashboard in minutes.</p></article><article><span><CalendarCheck size={19} /></span><strong>3. They keep the story going</strong><p>Students explore, log future sessions, and revisit progress over time.</p></article></div></section>

      <section className="value-talk-track"><div><span>MEETING TALKING POINTS</span><h2>A concise pitch you can use.</h2></div><ul>{talkingPoints.map(point => <li key={point}><Check size={16} /><span>{point}</span></li>)}</ul><blockquote>“I built Mat Metrics to help students see the value of all the ordinary classes that lead to promotions and long-term progress. It gives them a personal record of their consistency and journey, while giving the gym another way to motivate, retain, and celebrate its members—with no extra admin for coaches.”</blockquote></section>

      <section className="value-boundary value-owner-boundary"><div className="value-boundary-icon"><ShieldCheck size={25} /></div><div><span>A CREDIBLE PROMISE</span><h2>It measures commitment—not skill.</h2></div><p>Mat Metrics reveals participation, habits, and accumulated effort. Coaching remains the source of technical feedback; the app gives students context and recognition.</p></section>
      <section className="value-cta"><div><span>THE WORK ADDS UP</span><h2>Give students another reason<br />to keep showing up.</h2></div><a href="/"><span>Open Mat Metrics</span><ArrowRight size={18} /></a></section>
    </main>
    <footer className="value-footer"><span>mat<strong>metrics</strong><i>.</i></span><span>A personal record of time on the mats.</span><a href="/features">Explore every feature <ArrowRight size={14} /></a></footer>
  </div>
}
