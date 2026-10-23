import { useState, useEffect } from 'react';
import { CarouselSlide } from '../types/product';

interface HeroCarouselProps {
  slides: CarouselSlide[];
}

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!slides.length) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div className="relative h-[100vh] min-h-[600px] max-h-screen overflow-hidden">

      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-[1800ms] ease-in-out ${
            index === currentSlide
              ? 'opacity-100 z-10'
              : 'opacity-0 z-0'
          }`}
        >

          {/* Background Image */}
          <img
            src={slide.image}
            alt={slide.title}
            className={`
              absolute inset-0
              w-full h-full
              object-cover
              transition-transform duration-[7000ms] ease-linear
              ${
                index === currentSlide
                  ? 'scale-105'
                  : 'scale-100'
              }
            `}
          />

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />

          {/* Additional subtle bottom overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

          {/* Content */}
          <div className="relative z-10 h-full">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-16 h-full flex items-center">

              <div className="flex items-stretch">

                {/* Red Vertical Accent */}
                <div className="w-1 bg-[#960018] mr-8 sm:mr-10 lg:mr-12 min-h-[210px]" />

                {/* Text Content */}
                <div className="text-white max-w-2xl">

                  {/* Eyebrow */}
                  

                  {/* Main Heading */}
                  <h2 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl lg:text-6xl font-normal mb-3 leading-[0.95] tracking-tight">
                    <span className="text-white">{slide.title} </span>
                    <span className="text-[#960018]">{slide.title1}</span>
                  </h2>

                  {/* Subtitle */}
                  <p className="text-md sm:text-lg lg:text-xl mb-12 font-light leading-relaxed max-w-2xl">
                    {slide.subtitle}
                  </p>

                  {/* CTA Button */}
                  <a
                    href={slide.buttonLink || '/products'}
                    className="inline-flex items-center justify-center bg-[#960018] hover:bg-[#8E1220] text-white font-semibold text-lg px-8 py-2 rounded-sm transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {slide.buttonText || 'Explore Collection'}
                  </a>

                </div>
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}