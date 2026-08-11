import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useCart } from '../contexts/CartContext';
import { CartItem } from '../shared/types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash on pickup/delivery' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'in-person', label: 'Arrange with seller' },
];

export default function CartScreen({ navigation }: any) {
  const { cart, updateQuantity, removeItem, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;
    setPlaceError(null);
    setPlacing(true);
    try {
      // Note: the backend only reads `productId` + `quantity` per item - it looks the product
      // back up server-side and derives name/price/seller/totalAmount itself (see
      // backend/src/controllers/orderController.js createOrder). Sending the richer CartItem
      // shape here would be silently ignored, so we send exactly what it consumes.
      await api.orders.createOrder({
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        totalAmount: cart.total,
        paymentMethod,
      });
      await clearCart();
      setOrderPlaced(true);
    } catch (e) {
      setPlaceError(e instanceof Error ? e.message : 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (orderPlaced) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={56} color={colors.pitch400} />
        <Text style={styles.successTitle}>Order placed!</Text>
        <Text style={styles.successNote}>
          There&apos;s no online payment yet — pay the seller directly using the method you chose, and they&apos;ll confirm once settled.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Orders')}
        >
          <Text style={styles.primaryButtonText}>View My Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Marketplace')}
        >
          <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cart.items.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cart-outline" size={56} color={colors.inkMuted} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Marketplace')}>
          <Text style={styles.primaryButtonText}>Browse the Marketplace</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.itemName}>{item.name}</Text>
        <TouchableOpacity onPress={() => removeItem(item.productId)}>
          <Ionicons name="trash-outline" size={18} color={colors.wicket400} />
        </TouchableOpacity>
      </View>
      <Text style={styles.itemPrice}>${item.price.toFixed(2)} each</Text>
      <View style={styles.qtyRow}>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => updateQuantity(item.productId, item.quantity - 1)}
          >
            <Ionicons name="remove" size={16} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => updateQuantity(item.productId, item.quantity + 1)}
          >
            <Ionicons name="add" size={16} color={colors.ink} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtotal}>${(item.price * item.quantity).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.productId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.checkoutSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${cart.total.toFixed(2)}</Text>
            </View>

            <Text style={styles.sectionLabel}>Payment method</Text>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={styles.paymentOption}
                onPress={() => setPaymentMethod(m.value)}
              >
                <Ionicons
                  name={paymentMethod === m.value ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={paymentMethod === m.value ? colors.pitch400 : colors.inkMuted}
                />
                <Text style={styles.paymentLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.disclaimer}>
              No online payment processing yet — you&apos;ll settle up with the seller directly.
            </Text>

            {placeError && <Text style={styles.errorText}>{placeError}</Text>}

            <TouchableOpacity
              style={[styles.placeOrderButton, placing && styles.placeOrderButtonDisabled]}
              disabled={placing}
              onPress={handlePlaceOrder}
            >
              <Text style={styles.placeOrderButtonText}>{placing ? 'Placing order...' : 'Place Order'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 20 },
  successTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  successNote: { color: colors.inkSecondary, fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 19 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
  itemPrice: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 8 },
  stepperButton: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyText: { color: colors.ink, fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  subtotal: { color: colors.gold400, fontSize: 15, fontWeight: '700' },
  checkoutSection: {
    marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  totalValue: { color: colors.pitch400, fontSize: 18, fontWeight: '700' },
  sectionLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  paymentLabel: { color: colors.ink, fontSize: 14 },
  disclaimer: { color: colors.inkMuted, fontSize: 11, marginTop: 8, marginBottom: 14, lineHeight: 16 },
  errorText: { color: colors.wicket400, fontSize: 13, marginBottom: 10, textAlign: 'center' },
  placeOrderButton: { backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  placeOrderButtonDisabled: { backgroundColor: colors.surfaceAlt },
  placeOrderButtonText: { color: '#06170D', fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  primaryButtonText: { color: '#06170D', fontWeight: '700', fontSize: 14 },
  secondaryButton: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 24 },
  secondaryButtonText: { color: colors.pitch400, fontWeight: '600', fontSize: 14 },
});
