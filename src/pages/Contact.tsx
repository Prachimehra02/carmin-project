import { Mail, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-5xl lg:text-6xl font-bold text-[#2B1F3D] mb-8 text-center">Get in Touch</h1>
        <p className="text-center text-xl text-[#3B3B3B] mb-16 max-w-2xl mx-auto">
          We'd love to hear from you. Whether you have a question about our products or just want to say hello, feel free to reach out.
        </p>

        <div className="grid lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <Mail className="w-6 h-6 text-[#960018] mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-[#2B1F3D] mb-2">Email</h3>
                <p className="text-[#3B3B3B]">hello@carmin.com</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <Phone className="w-6 h-6 text-[#960018] mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-[#2B1F3D] mb-2">Phone</h3>
                <p className="text-[#3B3B3B]">+1 (555) 123-4567</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <MapPin className="w-6 h-6 text-[#960018] mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-[#2B1F3D] mb-2">Address</h3>
                <p className="text-[#3B3B3B]">
                  123 Design Avenue<br />
                  Creative City, CC 12345<br />
                  United States
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {submitted && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                Thank you for your message! We'll get back to you soon.
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[#2B1F3D] mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[#2B1F3D]/20 rounded-lg focus:outline-none focus:border-[#960018] transition bg-white"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#2B1F3D] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[#2B1F3D]/20 rounded-lg focus:outline-none focus:border-[#960018] transition bg-white"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-semibold text-[#2B1F3D] mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[#2B1F3D]/20 rounded-lg focus:outline-none focus:border-[#960018] transition bg-white"
                placeholder="Message subject"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-[#2B1F3D] mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={5}
                className="w-full px-4 py-3 border border-[#2B1F3D]/20 rounded-lg focus:outline-none focus:border-[#960018] transition resize-none bg-white"
                placeholder="Your message..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#2B1F3D] text-white font-semibold py-3 rounded-lg hover:bg-[#960018] transition duration-300"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
