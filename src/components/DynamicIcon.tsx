import React from 'react';
import {
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Scissors,
  Laptop,
  Armchair,
  Fuel,
  Receipt,
  Briefcase,
  Gift,
  CircleEllipsis,
  CircleDollarSign,
  Banknote,
  Building2,
  Landmark,
  CreditCard,
  Smartphone,
  Home,
  Trees,
  User,
  Tag,
  TrendingUp,
  PiggyBank,
  Sparkles,
  ArrowRightLeft,
  BookOpen,
  LucideProps,
} from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const iconMap: Record<string, React.FC<LucideProps>> = {
    UtensilsCrossed,
    Coffee,
    ShoppingBag,
    Scissors,
    Laptop,
    Armchair,
    Fuel,
    Receipt,
    Briefcase,
    Gift,
    CircleEllipsis,
    CircleDollarSign,
    Banknote,
    Building2,
    Landmark,
    CreditCard,
    Smartphone,
    Home,
    Trees,
    User,
    Tag,
    TrendingUp,
    PiggyBank,
    Sparkles,
    ArrowRightLeft,
    BookOpen,
  };

  const IconComponent = iconMap[name] || Tag;
  return <IconComponent {...props} />;
};
