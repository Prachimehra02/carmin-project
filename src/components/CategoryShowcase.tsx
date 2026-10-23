import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Category {
  id: string;
  name: string;
  label: string;
  image: string;
  bgGradient: string;
}

const categories: Category[] = [
  {
    id: 'pots-planters',
    name: 'pots-planters',
    label: 'Planters',
    image: 'https://images.pexels.com/photos/1095550/pexels-photo-1095550.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: 'from-amber-50 to-amber-100',
  },
  {
    id: 'vases',
    name: 'vases',
    label: 'Vases',
    image: 'https://images.pexels.com/photos/3945682/pexels-photo-3945682.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: 'from-stone-50 to-stone-100',
  },
  {
    id: 'home-decor',
    name: 'home-decor',
    label: 'Home Decor',
    image: 'https://images.pexels.com/photos/1994708/pexels-photo-1994708.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: 'from-blue-50 to-blue-100',
  },
];

export default function CategoryShowcase() {
  const navigate = useNavigate();

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  return (
    <div className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center gap-6 sm:gap-8 lg:gap-12 flex-wrap">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col items-center group cursor-pointer"
              onClick={() => handleCategoryClick(category.id)}
              style={{
                marginTop: index === 1 ? '2rem' : index === 2 ? '1rem' : '0',
              }}
            >
              <div className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden bg-gradient-to-b ${category.bgGradient} shadow-lg group-hover:shadow-2xl transition-all duration-300`}>
                <img
                  src={category.image}
                  alt={category.label}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="text-center text-[#2B1F3D] text-base sm:text-lg font-semibold tracking-wide mt-4">
                {category.label}
              </h3>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  ); 
}
