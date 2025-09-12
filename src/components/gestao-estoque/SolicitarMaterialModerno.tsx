import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, ShoppingCart } from 'lucide-react';

export const SolicitarMaterialModerno = () => {
  return (
    <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <Send className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-blue-700 text-lg">Solicitar Material</CardTitle>
        <CardDescription className="text-blue-600">
          Fazer pedido de materiais do estoque
        </CardDescription>
      </CardHeader>
    </Card>
  );
};