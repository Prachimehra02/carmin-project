import { Link } from 'react-router-dom';
import { Flower2, Sparkles, Leaf } from 'lucide-react';

interface CategoryCardProps {
  image: string;
  label: string;
  description: string;
  cta: string;
  number: string;
  alt: string;
  link: string;
  icon: 'vase' | 'objects' | 'planter';
}

export default function CategoryCard({
  image,
  label,
  description,
  cta,
  number,
  alt,
  link,
  icon,
}: CategoryCardProps) {
  const Icon =
    icon === 'vase'
      ? Flower2
      : icon === 'objects'
      ? Sparkles
      : Leaf;

  return (
    <Link
      to={link}
      className="group block"
    >
      <article className="h-full bg-[#FCFBF9] border border-[#E9E4DF] overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(43,31,25,0.08)]">

        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-[#F3F0EC]">
          <img
            src={image}
            alt={alt}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />

          {/* Subtle image overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.03] transition-colors duration-500" />
        </div>

        {/* Content */}
        <div className="relative px-7 pt-7 pb-8 md:px-8 md:pt-8 md:pb-9">

          {/* Icon */}
          <div className="absolute -top-7 right-7 md:right-8 w-14 h-14 rounded-full bg-white border border-[#E6DED8] flex items-center justify-center shadow-sm">
            <Icon
              className="w-6 h-6 text-[#6F0012]"
              strokeWidth={1.4}
            />
          </div>

          {/* Number */}
          {/* <div className="mb-4 pt-1">
            <span className="text-[#6F0012] text-xs tracking-[0.2em] font-medium">
              {number}
            </span>

            <div className="mt-2 w-7 h-px bg-[#6F0012]" />
          </div> */}

          {/* Title */}
          <h3 className="font-serif text-xl md:text-[22px] text-[#292929] tracking-[0.08em] uppercase transition-colors duration-300 group-hover:text-[#6F0012]">
            {label}
          </h3>

          {/* Description */}
          <p className="mt-3 text-sm text-[#756C65] leading-relaxed max-w-sm">
            {description}
          </p>

          {/* CTA */}
          <div className="mt-6 inline-flex items-center gap-4 text-[#6F0012] text-xs font-medium uppercase tracking-[0.16em]">
            <span className="relative">
              {cta}

              <span className="absolute left-0 -bottom-2 w-full h-px bg-[#6F0012] origin-left scale-x-100 transition-transform duration-300 group-hover:scale-x-0" />
            </span>

            <span className="text-base leading-none transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}