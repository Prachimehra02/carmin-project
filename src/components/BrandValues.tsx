import {
  Heart,
  Cylinder,
  HandHeart,
  Sprout,
} from 'lucide-react';

const values = [
  {
    icon: Heart,
    title: 'Thoughtfully Designed',
    description: 'Pieces made with purpose and intention.',
  },
  {
    icon: Cylinder,
    title: 'Premium Materials',
    description: 'Curated for quality, crafted to last.',
  },
  {
    icon: HandHeart,
    title: 'Handcrafted Excellence',
    description: 'Skilled artisans. Timeless creations.',
  },
  {
    icon: Sprout,
    title: 'Inspired by Nature',
    description: 'Bringing the serenity of nature into your home.',
  },
];

export default function BrandValues() {
  return (
    <section className="">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

          {values.map((value, index) => {
            const Icon = value.icon;

            return (
              <div
                key={value.title}
                className={`
                  flex flex-col items-center text-center
                  py-8 lg:py-6 px-6
                  relative
                  ${index < 3 ? 'lg:border-r lg:border-[#D8D3CE]' : ''}
                  ${index < 2 ? 'sm:border-r sm:border-[#D8D3CE]' : ''}
                `}
              >
                {/* Icon */}
                <div className="mb-6">
                  <Icon
                    strokeWidth={1.4}
                    className="w-10 h-10 text-[#960018]"
                  />
                </div>

                {/* Heading */}
                <h3 className="font-['Cormorant_Garamond'] text-xl lg:text-2xl font-medium text-[#44403C] mb-1">
                  {value.title}
                </h3>

                {/* Description */}
                <p className="text-sm lg:text-[15px] leading-relaxed text-[#78716C] max-w-[220px]">
                  {value.description}
                </p>

                {/* Bottom Line */}
                <div className="mt-6 w-8 h-[2px] bg-[#960018]" />
              </div>
            );
          })}

        </div>
      </div>
    </section>
  );
}