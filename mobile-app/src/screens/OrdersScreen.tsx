import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Order } from '../shared/types';

type Tab = 'buying' | 'selling';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.gold400,
  paid: colors.info,
  shipped: colors.gold500,
  completed: colors.pitch400,
  cancelled: colors.wicket400,
};

// Simple forward-only status progression a seller can push an order through.
const STATUS_FLOW = ['pending', 'paid', 'shipped', 'completed'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function nextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export default function OrdersScreen() {
  const [tab, setTab] = useState<Tab>('buying');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const request = tab === 'buying' ? api.orders.getMyOrders() : api.orders.getSellingOrders();
    request
      .then(({ orders }) => setOrders(orders))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.orders.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: status as Order['status'] } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, tab === 'buying' && styles.tabActive]} onPress={() => setTab('buying')}>
          <Text style={[styles.tabText, tab === 'buying' && styles.tabTextActive]}>My Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'selling' && styles.tabActive]} onPress={() => setTab('selling')}>
          <Text style={[styles.tabText, tab === 'selling' && styles.tabTextActive]}>Selling</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
          ListEmptyComponent={
            <Text style={styles.muted}>
              {tab === 'buying' ? 'No orders yet.' : 'No sales yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const upcoming = nextStatus(item.status);
            const canCancel = item.status !== 'completed' && item.status !== 'cancelled';
            return (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[item.status] ?? colors.inkMuted}22` }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] ?? colors.inkMuted }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {item.items.map((line, idx) => (
                  <Text key={idx} style={styles.lineItem}>
                    {line.quantity}x {line.name} — ${(line.price * line.quantity).toFixed(2)}
                  </Text>
                ))}

                <Text style={styles.totalText}>Total: ${item.totalAmount.toFixed(2)}</Text>
                <Text style={styles.paymentText}>Payment: {item.paymentMethod}</Text>

                {tab === 'selling' && (upcoming || canCancel) && (
                  <View style={styles.actionsRow}>
                    {upcoming && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        disabled={updatingId === item._id}
                        onPress={() => handleUpdateStatus(item._id, upcoming)}
                      >
                        <Text style={styles.actionButtonText}>
                          {updatingId === item._id ? 'Updating...' : `Mark ${upcoming}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {canCancel && (
                      <TouchableOpacity
                        style={styles.actionButtonSecondary}
                        disabled={updatingId === item._id}
                        onPress={() => handleUpdateStatus(item._id, 'cancelled')}
                      >
                        <Text style={styles.actionButtonSecondaryText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabsRow: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  tabActive: { backgroundColor: colors.pitch500 },
  tabText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#06170D' },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, textAlign: 'center', marginTop: 24 },
  errorText: { color: colors.wicket400, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateText: { color: colors.inkMuted, fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  lineItem: { color: colors.inkSecondary, fontSize: 13, marginBottom: 2 },
  totalText: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 6 },
  paymentText: { color: colors.inkMuted, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, backgroundColor: colors.pitch500, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  actionButtonText: { color: '#06170D', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  actionButtonSecondary: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingVertical: 9, alignItems: 'center',
    borderWidth: 1, borderColor: colors.wicket500,
  },
  actionButtonSecondaryText: { color: colors.wicket400, fontSize: 12, fontWeight: '700' },
});
