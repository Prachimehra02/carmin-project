import { Link } from 'react-router-dom';
import HeroCarousel from '../components/HeroCarousel';
import ProductGridHome from '../components/ProductGridHome';
import CategoryCard from '../components/CategoryCard';
import { carouselSlides } from '../data/products';
import { useProducts } from '../hooks/useProducts';
import BrandValues from '../components/BrandValues';

export default function Home() {
  const { products: featuredProducts  } = useProducts({ featured: true, limit: 3, });

  return (
    <div>
      <HeroCarousel slides={carouselSlides} />

      {/* Curated collection section */}
      <section className="py-6 md:py-8 lg:py-8 bg-white">
  <div className="max-w-7xl mx-auto px-6">

    {/* Section Header */}
    <div className="flex items-center justify-center gap-4 mb-2">
           <span className="w-8 h-px bg-[#960018]/30" />
           <span className="text-[10px] sm:text-xs tracking-[0.28em] uppercase text-[#960018]">Curated collection</span>
           <span className="w-8 h-px bg-[#960018]/30" />
         </div>

    {/* Main heading */}
    <h2 className="font-[Manrope] text-center text-3xl sm:text-4xl lg:text-[2.5rem] font-normal leading-[1.1] tracking-[-0.025em] text-[#2B2B2B] mb-6">
      The Carmin Edit
    </h2>

    {/* Collection Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
      <CategoryCard
        image="/category-1.jpeg"
        label="Vase Collection"
        description="Sculptural forms that bring quiet beauty to your corners."
        cta="Discover More"
        number="01"
        alt="Vase collection"
        link="/category/vases"
        icon="vase"
      />

      <CategoryCard
        image="/category-2.jpg"
        label="Objects of Desire"
        description="Beautifully chosen everyday objects with a story to tell."
        cta="Explore The Edit"
        number="02"
        alt="Decorative pieces"
        link="/home-decor"
        icon="objects"
      />

      <CategoryCard
        image="/category-3.jpg"
        label="The Planter Edit"
        description="Bring nature indoors and breathe life into your space."
        cta="Shop Planters"
        number="03"
        alt="Pots and planters"
        link="/category/pots-planters"
        icon="planter"
      />
    </div>

    {/* Bottom CTA */}
    {/* <div className="mt-10 md:mt-12 flex justify-center">
      <Link
        to="/products"
        className="group inline-flex items-center gap-5 border border-[#6F0012] px-8 py-3.5 text-[#6F0012] text-xs md:text-sm font-medium uppercase tracking-[0.2em] transition-all duration-300 hover:bg-[#6F0012] hover:text-white"
      >
        <span>Explore All Collections</span>

        <span className="text-lg leading-none transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div> */}

  </div>
</section>

     {featuredProducts.length > 0 && (
        <ProductGridHome
          title=""
          products={featuredProducts.slice(0, 2)}
          id="featured-products"
        />
      )}

      
     <section className="bg-[#F8F6F2] py-6 sm:py-10 lg:py-12">
       <div className="max-w-5xl mx-auto px-6">
         
         {/* Small heading */}
         <div className="flex items-center justify-center gap-4 mb-8">
           <span className="w-8 h-px bg-[#960018]/30" />
           <span className="text-[10px] sm:text-xs tracking-[0.28em] uppercase text-[#960018]">The Carmin Philosophy</span>
           <span className="w-8 h-px bg-[#960018]/30" />
         </div>

    {/* Main heading */}
    <h2 className="font-[Manrope] text-center text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.025em] text-[#2B2B2B]">
      Timeless objects for modern living
    </h2>

    {/* Description */}
    <div className="max-w-xl mx-auto mt-6 text-center">
      <p className="text-[15px] sm:text-base leading-7 text-[#57534E]">
        Refined, thoughtfully made objects designed to bring beauty and intention to everyday moments. Timeless forms, considered materials, and subtle details come together to create pieces made to be lived with and loved for years.
      </p>
    </div>

    {/* CTA */}
    <div className="mt-8 flex justify-center">
      <Link
        to="/about"
        className="group inline-flex items-center gap-3 text-xs sm:text-sm tracking-[0.2em] uppercase text-[#960018]"
      >
        <span className="transition-colors duration-300">
          Discover our story
        </span>

        <span className="text-base transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div>

    {/* Bottom detail */}
    {/* <div className="mx-auto mt-5 h-px w-10 bg-[#960018]/30 transition-all duration-500 group-hover:w-16" /> */}

  </div>
</section>
      
      {/* <BrandValues /> */}

      <section className="bg-white py-8">
        <div className="grid lg:grid-cols-2 min-h-[720px] lg:min-h-[90vh]">
          
          <div className="flex items-center justify-center px-8 sm:px-12 lg:px-16 py-16 lg:py-0">
            <div className="max-w-md">
              <h2 className="font-[Manrope] text-4xl lg:text-5xl text-[#2B1F3D] mb-4 leading-tight">Crafted to Connect You to Your Space </h2>
              <p className="text-lg text-[#2B1F3D] mb-14 leading-relaxed">
                Every piece is designed not simply for beauty, but to create a deeper connection with the space you call your own.
              </p>
              <Link to="/products" className="inline-block bg-[#960018] text-white px-8 py-4 font-semibold tracking-widest uppercase hover:bg-[#2B1F3D] transition duration-300 text-sm">
                Explore Our Collection
              </Link>
            </div>
          </div>

          <div className="h-80 lg:h-full overflow-hidden">
            <img
              src="/Section_2.jpeg"
              alt="Styled interior with plants and candles"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* {featuredProducts.length > 0 && (
        <ProductGridHome
          title=""
          products={featuredProducts.slice(0, 3)}
          id="featured-products"
        />
      )} */}

      

    </div>
  );
}
