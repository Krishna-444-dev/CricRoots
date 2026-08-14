import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { resolveRefName } from '../shared/utils/resolveRef';
import { Product } from '../shared/types';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = ['equipment', 'apparel', 'accessories', 'other'] as const;

function sellerName(seller: Product['seller']): string {
  return resolveRefName(seller, 'Unknown');
}

export default function MarketplaceScreen({ navigation }: any) {
  const { cart, addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sellCategory, setSellCategory] = useState<string>('equipment');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [sellError, setSellError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.products.getProducts(category || undefined)
      .then(({ products }) => setProducts(products))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load products'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [category]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.cartHeaderButton} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart" size={22} color={colors.ink} />
          {cart.items.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.items.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, cart.items.length]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAdd = (product: Product) => {
    addItem(product, 1);
    setAddedId(product._id);
    setTimeout(() => setAddedId((current) => (current === product._id ? null : current)), 1200);
  };

  const resetSellForm = () => {
    setName(''); setDescription(''); setSellCategory('equipment'); setPrice(''); setStock('1'); setSellError(null);
  };

  const openSellModal = () => { resetSellForm(); setSellModalVisible(true); };

  const handleCreateListing = async () => {
    setSellError(null);
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);
    if (!name.trim()) { setSellError('Item name is required.'); return; }
    if (isNaN(parsedPrice) || parsedPrice < 0) { setSellError('Enter a valid price.'); return; }
    if (isNaN(parsedStock) || parsedStock < 0) { setSellError('Enter a valid stock quantity.'); return; }

    setSubmitting(true);
    try {
      await api.products.createProduct({
        name: name.trim(),
        description: description.trim(),
        category: sellCategory,
        price: parsedPrice,
        stock: parsedStock,
      });
      setSellModalVisible(false);
      setLoading(true);
      load();
    } catch (e) {
      setSellError(e instanceof Error ? e.message : 'Could not create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['', ...CATEGORIES]}
          keyExtractor={(item) => item || 'all'}
          contentContainerStyle={styles.chipsContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, category === item && styles.chipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>
                {item === '' ? 'All' : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isAuthenticated && (
        <TouchableOpacity style={styles.sellButton} onPress={openSellModal}>
          <Ionicons name="add-circle-outline" size={18} color={colors.pitch400} />
          <Text style={styles.sellButtonText}>Sell an item</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
          ListEmptyComponent={<Text style={styles.muted}>No listings yet{category ? ` in ${category}` : ''}.</Text>}
          renderItem={({ item }) => {
            const outOfStock = item.stock <= 0;
            const justAdded = addedId === item._id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                </View>
                <Text style={styles.cardMeta}>{item.category} · by {sellerName(item.seller)}</Text>
                {!!item.description && (
                  <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
                )}
                <Text style={styles.stockText}>{outOfStock ? 'Out of stock' : `${item.stock} in stock`}</Text>
                <TouchableOpacity
                  style={[styles.addButton, (outOfStock || justAdded) && styles.addButtonDisabled]}
                  disabled={outOfStock}
                  onPress={() => handleAdd(item)}
                >
                  <Text style={styles.addButtonText}>{justAdded ? 'Added!' : outOfStock ? 'Out of stock' : 'Add to Cart'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={sellModalVisible} animationType="slide" transparent onRequestClose={() => setSellModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Sell an Item</Text>
                <TouchableOpacity onPress={() => setSellModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.inkMuted} />
                </TouchableOpacity>
              </View>

              {sellError && <Text style={styles.errorText}>{sellError}</Text>}

              <Text style={styles.fieldLabel}>Item Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Cricket bat" placeholderTextColor={colors.inkMuted} />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Condition, size, details..."
                placeholderTextColor={colors.inkMuted}
                multiline
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipsInline}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, sellCategory === c && styles.chipActive]}
                    onPress={() => setSellCategory(c)}
                  >
                    <Text style={[styles.chipText, sellCategory === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.rowFields}>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Price ($)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={colors.inkMuted} keyboardType="decimal-pad" />
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Stock</Text>
                  <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="1" placeholderTextColor={colors.inkMuted} keyboardType="number-pad" />
                </View>
              </View>

              <TouchableOpacity style={styles.submitButton} disabled={submitting} onPress={handleCreateListing}>
                <Text style={styles.submitButtonText}>{submitting ? 'Publishing...' : 'List Item'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  chipsRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chipsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.pitch500 },
  chipText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#06170D' },
  sellButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginHorizontal: 16, marginTop: 12, paddingVertical: 6,
  },
  sellButtonText: { color: colors.pitch400, fontSize: 13, fontWeight: '700' },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, textAlign: 'center', marginTop: 24 },
  errorText: { color: colors.wicket400, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1 },
  cardPrice: { color: colors.gold400, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  cardDescription: { color: colors.inkSecondary, fontSize: 13, marginTop: 6 },
  stockText: { color: colors.inkMuted, fontSize: 12, marginTop: 8 },
  addButton: {
    backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10,
  },
  addButtonDisabled: { backgroundColor: colors.surfaceAlt },
  addButtonText: { color: '#06170D', fontWeight: '700', fontSize: 13 },
  cartHeaderButton: { marginRight: 8, padding: 4 },
  cartBadge: {
    position: 'absolute', top: -4, right: -6, backgroundColor: colors.wicket500,
    borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 20, maxHeight: '85%',
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 14,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },
  submitButton: {
    backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  submitButtonText: { color: '#06170D', fontWeight: '700', fontSize: 14 },
});
