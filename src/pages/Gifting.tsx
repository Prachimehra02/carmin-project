import { useState } from 'react';
import { Gift, Heart, Sparkles, Ribbon, MapPin, Calendar, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';

export default function Gifting() {
  const [selectedOption, setSelectedOption] = useState<'ready-made' | 'custom' | null>(null);
  const [giftType, setGiftType] = useState('');
  const { products } = useProducts({});

  const giftingOptions = [
    {
      id: 'occasions',
      title: 'Gift by Occasion',
      items: [
        { label: 'Birthdays', value: 'birthday' },
        { label: 'Anniversaries', value: 'anniversary' },
        { label: 'Housewarming', value: 'housewarming' },
        { label: 'Thank You', value: 'thank-you' },
        { label: 'Celebrations', value: 'celebration' },
      ]
    },
    {
      id: 'recipient',
      title: 'Gift by Recipient',
      items: [
        { label: 'Plant Lovers', value: 'plant-lovers' },
        { label: 'Home Decorators', value: 'decorators' },
        { label: 'Minimalists', value: 'minimalists' },
        { label: 'Art Enthusiasts', value: 'art-lovers' },
      ]
    }
  ];

  const customizationOptions = [
    {
      icon: Gift,
      title: 'Premium Gift Wrapping',
      description: 'Beautiful, eco-friendly wrapping with your choice of ribbon and tissue paper'
    },
    {
      icon: MessageSquare,
      title: 'Personalized Card',
      description: 'Add a custom message card to make your gift extra special'
    },
    {
      icon: Ribbon,
      title: 'Gift Box Upgrade',
      description: 'Premium packaging that makes unboxing a memorable experience'
    },
    {
      icon: MapPin,
      title: 'Direct Delivery',
      description: 'Send directly to your recipient with a personal note'
    },
    {
      icon: Calendar,
      title: 'Scheduled Delivery',
      description: 'Choose the perfect date for your gift to arrive'
    },
    {
      icon: Sparkles,
      title: 'Gift Message',
      description: 'Include a heartfelt message with your gift'
    }
  ];

  const featuredGifts = products.slice(0, 8);

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <div className="h-[500px] bg-gradient-to-br from-[#2B1F3D] to-[#960018] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center relative z-10 px-4"
        >
          <div className="flex justify-center mb-6">
            <Gift className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-serif text-white mb-4">Gift Collections</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Curated pieces for every occasion. Personalize your gift and make it unforgettable.
          </p>
        </motion.div>
      </div>

      {/* Gift Options */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* Ready-Made Gifts */} 
          {/* <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="group cursor-pointer"
            onClick={() => setSelectedOption('ready-made')}
          >
            <div className="relative overflow-hidden rounded-2xl h-80 mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-blue-100 group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Heart className="w-24 h-24 text-emerald-600 opacity-20" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute inset-0 flex items-end p-8">
                <div>
                  <h3 className="text-3xl font-serif text-white mb-2">Ready-Made Gifts</h3>
                  <p className="text-white/90">Curated collections for every occasion</p>
                </div>
              </div>
            </div>
          </motion.div> */}

          {/* Custom Gifts */}
          {/* <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="group cursor-pointer"
            onClick={() => setSelectedOption('custom')}
          >
            <div className="relative overflow-hidden rounded-2xl h-80 mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-100 to-purple-100 group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-24 h-24 text-rose-600 opacity-20" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute inset-0 flex items-end p-8">
                <div>
                  <h3 className="text-3xl font-serif text-white mb-2">Customize Your Gift</h3>
                  <p className="text-white/90">Create a personalized experience</p>
                </div>
              </div>
            </div>
          </motion.div> */} 
        </div>

        {/* Gift Categories */}
        {/* {selectedOption === 'ready-made' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <h2 className="text-3xl font-serif mb-12 text-center text-[#2B1F3D]">Choose Your Gift Category</h2>
            <div className="grid md:grid-cols-2 gap-12">
              {giftingOptions.map((option) => (
                <div key={option.id}>
                  <h3 className="text-xl font-semibold mb-6 text-[#2B1F3D]">{option.title}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {option.items.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setGiftType(item.value)}
                        className={`p-4 rounded-lg border-2 transition text-left font-medium ${
                          giftType === item.value
                            ? 'bg-[#960018] text-white border-[#960018]'
                            : 'bg-white text-[#2B1F3D] border-gray-200 hover:border-[#960018]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )} */}

        {/* Customization Options */}
        {/* {selectedOption === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <h2 className="text-3xl font-serif mb-12 text-center text-[#2B1F3D]">Customize Your Gift</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {customizationOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-xl p-8 border border-gray-100 hover:border-[#960018] hover:shadow-lg transition group"
                  >
                    <div className="mb-4 inline-block p-3 bg-gradient-to-br from-[#2B1F3D]/10 to-[#960018]/10 rounded-lg group-hover:from-[#960018]/20 group-hover:to-[#960018]/20 transition">
                      <Icon className="w-6 h-6 text-[#960018]" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-[#2B1F3D]">{option.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{option.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )} */}

        {/* Featured Gift Products */}
        <div className="mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-serif mb-4 text-[#2B1F3D]">Popular Gifts</h2>
            <p className="text-gray-600 mb-12">Handpicked items that make perfect gifts for any occasion</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredGifts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* How It Works */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-[#2B1F3D]/5 to-[#960018]/5 rounded-2xl p-12 mb-20"
        >
          <h2 className="text-3xl font-serif mb-12 text-center text-[#2B1F3D]">How Gift Ordering Works</h2>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Choose Your Gift', desc: 'Browse our collections and select the perfect item' },
              { step: '2', title: 'Personalize', desc: 'Add wrapping, cards, and special touches' },
              { step: '3', title: 'Delivery Options', desc: 'Schedule delivery or send directly to recipient' },
              { step: '4', title: 'Create Memories', desc: 'Watch your gift make someone smile' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-[#960018] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-[#2B1F3D] mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div> */}

        {/* CTA Section */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-[#2B1F3D] rounded-2xl p-12 text-center text-white"
        >
          <h2 className="text-3xl font-serif mb-4">Ready to Give a Gift?</h2>
          <p className="text-white/80 mb-8 max-w-2xl mx-auto">
            Browse our collections and create a personalized gift experience that will be remembered for years to come.
          </p>
          <Link
            to="/products"
            className="inline-block bg-[#960018] hover:bg-[#8A1119] text-white font-semibold px-8 py-3 rounded-lg transition"
          >
            Start Gifting
          </Link>
        </motion.div> */}
      </div>
    </div>
  );
}
