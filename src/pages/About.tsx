
import { Link } from 'react-router-dom';
import { Gem, Heart, Sparkles, ArrowRight } from 'lucide-react';

const images = {
  hero: '/images/about/hero.jpg',
  story: '/images/about/story.jpg',
  craft: '/images/about/craft.jpg',
  closing: '/images/about/closing.jpg',
};

const values = [
  {
    icon: Gem,
    title: 'Considered Curation',
    description:
      'Pieces chosen for their distinctive form, thoughtful details, and lasting appeal.',
  },
  {
    icon: Heart,
    title: 'Meaningful Living',
    description:
      'Objects that bring character, warmth, and a personal touch to the spaces we call home.',
  },
  {
    icon: Sparkles,
    title: 'Attention to Detail',
    description:
      'An appreciation for beautiful textures, refined finishes, and timeless design.',
  },
];

export default function About() {
  return (
    <main className="bg-white overflow-hidden">

      {/* 01 — EDITORIAL HERO */}
      <section className="relative min-h-[420px] md:min-h-[520px] flex items-center">

        <img
          src={images.hero}
          alt="Elegant home decor displayed on a marble console"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-16">

          <p className="text-white/90 text-[11px] tracking-[0.3em] uppercase mb-6 flex items-center gap-4">
            The Story of Carmin
            <span className="w-10 h-px bg-white/60" />
          </p>

          <h1 className="font-serif font-normal text-white text-4xl sm:text-5xl lg:text-[58px] leading-[1.12] tracking-tight max-w-2xl">
            Objects with Meaning.
            <br />
            Spaces with Soul.
          </h1>

          <p className="text-white/90 text-sm sm:text-base leading-relaxed mt-6 max-w-md">
            Thoughtfully curated décor that transforms everyday spaces into something deeply personal.
          </p>

        </div>
      </section>

      {/* 02 — OUR STORY */}
      <section className="py-8 lg:py-8">

        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">

          <div className="overflow-hidden">
            <img
              src={images.story}
              alt="Curated ceramic vases arranged in a warm interior"
              loading="lazy"
              className="w-full h-[340px] sm:h-[420px] lg:h-[480px] object-cover"
            />
          </div>

          <div className="max-w-lg">
            <p className="text-[#960018] text-[11px] font-medium uppercase tracking-[0.25em] mb-5">
              01 / Our Story
            </p>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal leading-tight text-[#2B1F3D] mb-6">
              Beauty in the Everyday
            </h2>

            <p className="text-[#625B60] text-[15px] sm:text-base leading-[1.9]">
              Carmin began with a simple belief: the objects we surround ourselves with should do more than fill a space.
              They should reflect our individuality and make everyday living more meaningful.
            </p>

            <p className="text-[#625B60] text-[15px] sm:text-base leading-[1.9] mt-4">
              We bring together thoughtfully chosen pieces that add elegance, character, and intention to your home,
              transforming ordinary moments into something memorable.
            </p>
          </div>

        </div>
      </section>

      {/* 03 — OUR PHILOSOPHY */}
      
      {/* <section className="bg-[#F7F3EF] py-8 lg:py-8">

        <div className="max-w-4xl mx-auto px-6 text-center">

          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="w-8 h-px bg-[#960018]/30" />
            <p className="text-[#960018] text-[11px] uppercase tracking-[0.25em] font-medium">
              Our Philosophy
            </p>
            <span className="w-8 h-px bg-[#960018]/30" />
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal text-[#2B1F3D] leading-tight mb-6">
            Timeless Beauty, Thoughtfully Chosen.
          </h2>

          <p className="text-[#625B60] text-[15px] sm:text-base leading-[1.9] max-w-2xl mx-auto">
            We believe in considered design, enduring aesthetics, and the quiet beauty of objects that feel at home in your space.
            Every piece in our collection is selected with care, with both form and function in mind.
          </p>

        </div>
      </section> */}

      {/* 04 — OUR CRAFT */}
      <section className="pb-8 lg:pb-8">

        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">

          <div className="max-w-lg order-2 lg:order-1">

            <p className="text-[#960018] text-[11px] font-medium uppercase tracking-[0.25em] mb-5">
              02 / Our Craft
            </p>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal leading-tight text-[#2B1F3D] mb-6">
              The Beauty Is in the Details.
            </h2>

            <p className="text-[#625B60] text-[15px] sm:text-base leading-[1.9]">
              From sculptural silhouettes to beautiful textures and thoughtful finishes,
              we appreciate the small details that make a piece truly special.
            </p>

            <p className="text-[#625B60] text-[15px] sm:text-base leading-[1.9] mt-4">
              Our collection brings together ceramics, vases, planters, and decorative objects
              chosen for their distinctive character and ability to complement modern living.
            </p>

          </div>

          <div className="overflow-hidden order-1 lg:order-2">
            <img
              src={images.craft}
              alt="Close-up of the texture and details of a decorative ceramic vase"
              loading="lazy"
              className="w-full h-[340px] sm:h-[420px] lg:h-[480px] object-cover"
            />
          </div>

        </div>
      </section>

      {/* 05 — OUR COMMITMENT */}
      <section className="pb-8 lg:pb-8">

        <div className="bg-[#F7F3EF] max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-12 lg:py-12">

          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="w-8 h-px bg-[#960018]/30" />
            <p className="text-[#960018] text-[11px] uppercase tracking-[0.25em] font-medium">
              Our Commitment
            </p>
            <span className="w-8 h-px bg-[#960018]/30" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0">

            {values.map((value, index) => {
              const Icon = value.icon;

              return (
                <div
                  key={value.title}
                  className={`text-center px-6 lg:px-10 ${
                    index !== 0
                      ? 'md:border-l md:border-[#D9CEC5]'
                      : ''
                  }`}
                >

                  <Icon
                    size={32}
                    strokeWidth={1.4}
                    className="text-[#960018] mx-auto mb-6"
                  />

                  <h3 className="font-serif text-xl lg:text-2xl font-normal text-[#2B1F3D] mb-3">
                    {value.title}
                  </h3>

                  <p className="text-[#625B60] text-sm leading-[1.8] max-w-xs mx-auto">
                    {value.description}
                  </p>

                </div>
              );
            })}

          </div>
        </div>
      </section>

      {/* 06 — CLOSING BANNER */}
      <section className="relative min-h-[380px] md:min-h-[460px] flex items-center">

        <img
          src={images.closing}
          alt="Beautifully styled living space with curated home decor"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-16">

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[48px] font-normal text-white leading-tight max-w-2xl mb-5">
            Make Space for What Matters.
          </h2>

          <p className="text-white/90 text-sm sm:text-base leading-relaxed max-w-md mb-8">
            Discover objects that bring beauty, character, and meaning to your everyday surroundings.
          </p>

          <Link
            to="/products"
            className="inline-flex items-center gap-3 bg-[#960018] text-white px-7 py-4 text-xs uppercase tracking-[0.12em] font-semibold hover:bg-[#7A0014] transition-colors duration-300"
          >
            Explore Our Collection
            <ArrowRight size={16} />
          </Link>

        </div>
      </section>

    </main>
  );
}
