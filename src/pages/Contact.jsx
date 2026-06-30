import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from '../components/Icons';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import portfolioData from '../data/portfolio.json';
import './Contact.css';

export default function Contact() {
  const { email, social } = portfolioData.about;

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
