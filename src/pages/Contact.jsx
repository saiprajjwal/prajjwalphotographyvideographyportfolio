import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Copy, Check } from 'lucide-react';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from '../components/Icons';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import portfolioData from '../data/portfolio.json';
import './Contact.css';

// Optional: set VITE_WEB3FORMS_KEY in the env to deliver form submissions
// directly (web3forms.com). Without it the form composes a prefilled email.
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY;

export default function Contact() {
  const { email, social } = portfolioData.about;

  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [copied, setCopied] = useState(false);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const composed = `Hi Prajjwal,\n\n${form.message}\n\n— ${form.name}${form.email ? ` (${form.email})` : ''}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (WEB3FORMS_KEY) {
      setStatus('sending');
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            name: form.name,
            email: form.email,
            message: form.message,
            subject: `Portfolio inquiry from ${form.name}`,
          }),
        });
        const data = await res.json();
        setStatus(data.success ? 'sent' : 'error');
      } catch {
        setStatus('error');
      }
    } else {
      // No form service configured — open a prefilled email instead
      const subject = encodeURIComponent(`Portfolio inquiry from ${form.name}`);
      const body = encodeURIComponent(composed);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      setStatus('sent');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${email}\n\n${composed}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — the email address is shown on the card below */ }
  };

  return (
    <motion.div 
      className="contact-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <AmbientGlassBackground />

      <main className="page-wrapper section-padding contact-content-overlay">
        <div className="container contact-container">
          <header className="page-header">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Get in Touch
            </motion.h1>
            <motion.p 
              className="contact-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Available for freelance opportunities. Let's create something beautiful together.
            </motion.p>
          </header>

          <motion.form
            className="contact-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="contact-form-row">
              <label className="contact-field">
                <span>Name</span>
                <input type="text" required value={form.name} onChange={setField('name')} placeholder="Your name" />
              </label>
              <label className="contact-field">
                <span>Email</span>
                <input type="email" required value={form.email} onChange={setField('email')} placeholder="you@example.com" />
              </label>
            </div>
            <label className="contact-field">
              <span>Message</span>
              <textarea required rows={5} value={form.message} onChange={setField('message')} placeholder="Tell me about your project — shoot type, dates, location…" />
            </label>
            <div className="contact-form-actions">
              <button type="submit" className="contact-send-btn" disabled={status === 'sending'}>
                <Send size={17} />
                {status === 'sending' ? 'Sending…' : 'Send Message'}
              </button>
              <button type="button" className="contact-copy-btn" onClick={handleCopy} title="Copy the message and email address">
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy instead'}
              </button>
            </div>
            {status === 'sent' && (
              <p className="contact-form-note ok">
                {WEB3FORMS_KEY ? 'Thanks! Your message is on its way.' : 'Your email app should have opened with the message ready — just hit send. If it didn’t, use "Copy instead" and paste it into any email.'}
              </p>
            )}
            {status === 'error' && (
              <p className="contact-form-note err">Something went wrong — please email me directly at {email}.</p>
            )}
          </motion.form>

          <div className="contact-links">
            <motion.a 
              href={`mailto:${email}`} 
              className="contact-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Mail size={48} strokeWidth={1} />
              <h2>Email Me</h2>
              <p>{email}</p>
            </motion.a>

            <motion.a 
              href={social.instagram} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <InstagramIcon size={48} />
              <h2>Instagram</h2>
              <p>@saiprajjwal</p>
            </motion.a>

            <motion.a 
              href={social.youtube} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <YoutubeIcon size={48} />
              <h2>YouTube</h2>
              <p>Subscribe for films</p>
            </motion.a>

            <motion.a 
              href={social.tiktok} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <TiktokIcon size={48} />
              <h2>TikTok</h2>
              <p>@prajjwalp</p>
            </motion.a>

            <motion.a 
              href={social.pinterest} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <PinterestIcon size={48} />
              <h2>Pinterest</h2>
              <p>Inspiration board</p>
            </motion.a>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
