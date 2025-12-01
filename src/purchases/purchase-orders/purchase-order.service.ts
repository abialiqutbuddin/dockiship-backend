import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { POStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderItemsDto } from './dto/receive-purchase-order-items.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) { }

  async create(tenantId: string, userId: string | null, dto: CreatePurchaseOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Add at least one line item');
    }

    const [supplier, warehouse, tenant] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
        select: { id: true, currency: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId, isActive: true },
        select: { id: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { currency: true },
      }),
    ]);

    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const distinctProductIds = [...new Set(dto.items.map((i) => i.productId).filter(Boolean))];
    if (distinctProductIds.length === 0) {
      throw new BadRequestException('Each line must reference a product');
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: distinctProductIds } },
      select: { id: true },
    });
    if (products.length !== distinctProductIds.length) {
      throw new NotFoundException('One or more products are invalid or unavailable for this tenant');
    }

    const currency = (dto.currency || supplier.currency || tenant?.currency || 'USD').toUpperCase();

    let subtotal = 0;
    let productTax = 0;

    const itemsData: Prisma.PurchaseOrderItemCreateWithoutPurchaseOrderInput[] = dto.items.map((item) => {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantity must be at least 1');
      }

      const unitPrice = Number(item.unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException('Each line item requires a unit price greater than zero');
      }

      const taxRate = item.taxRate != null ? Number(item.taxRate) : 0;
      if (!Number.isFinite(taxRate) || taxRate < 0) {
        throw new BadRequestException('Tax rate cannot be negative');
      }

      const lineSubtotal = quantity * unitPrice;
      const taxAmount = lineSubtotal * (taxRate / 100);

      subtotal += lineSubtotal;
      productTax += taxAmount;

      return {
        productId: item.productId,
        productVariantId: item.productVariantId || undefined,
        quantity,
        unitPrice,
        currency,
        taxRate,
        taxAmount,
        notes: item.notes || undefined,
      } as Prisma.PurchaseOrderItemCreateWithoutPurchaseOrderInput;
    });

    const shippingCost = Number(dto.shippingCost ?? 0) || 0;
    const shippingTax = Number(dto.shippingTax ?? 0) || 0;
    const totalAmount = subtotal + productTax + shippingCost + shippingTax;

    const poNumber = await this.generatePoNumber(tenantId);

    const expectedDate = dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null;
    if (dto.expectedDeliveryDate && (!expectedDate || Number.isNaN(expectedDate.getTime()))) {
      throw new BadRequestException('Expected delivery date is invalid');
    }

    const created = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        status: dto.status || POStatus.to_purchase,
        expectedDeliveryDate: expectedDate,
        notes: dto.notes || null,
        currency,
        subtotal,
        productTax,
        shippingCost,
        shippingTax,
        totalAmount,
        amountPaid: dto.amountPaid || 0,
        poNumber,
        createdByUserId: userId || undefined,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
      },
    });

    return created;
  }

  async list(
    tenantId: string,
    params: {
      page?: number;
      perPage?: number;
      search?: string;
      status?: string;
      supplierId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const {
      page = 1,
      perPage = 25,
      search,
      status,
      supplierId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.PurchaseOrderWhereInput = { tenantId };

    if (status) {
      where.status = status as POStatus;
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }
    if (search) {
      where.OR = [
        { poNumber: { contains: search } },
        { supplier: { companyName: { contains: search } } },
        { warehouse: { name: { contains: search } } },
      ];
    }

    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {};
    if (sortBy === 'supplier') {
      orderBy.supplier = { companyName: sortOrder };
    } else if (sortBy === 'warehouse') {
      orderBy.warehouse = { name: sortOrder };
    } else if (sortBy) {
      // @ts-ignore
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [items, total, statusCounts] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy,
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
        select: {
          id: true,
          poNumber: true,
          createdAt: true,
          expectedDeliveryDate: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          currency: true,
          supplier: { select: { id: true, companyName: true, email: true } },
          warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    const counts = statusCounts.reduce((acc, curr) => {
      // Cast to any because Prisma types for groupBy _count can be tricky with strict checks
      const c = curr._count as any;
      acc[curr.status] = c?.status ?? 0;
      return acc;
    }, {} as Record<string, number>);

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        totalPages: Math.ceil(total / Number(perPage)),
      },
      counts,
    };
  }

  async findOne(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: { select: { id: true, companyName: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, images: true } },
            productVar: { select: { id: true, sku: true, sizeText: true, colorText: true, stockOnHand: true } },
          },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async updateStatus(tenantId: string, id: string, status: POStatus, notes?: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
      },
    });

    if (!po) throw new NotFoundException('Purchase order not found');

    // Once received, status is immutable
    if (po.status === POStatus.received) {
      if (status !== POStatus.received) {
        throw new BadRequestException('Received purchase orders cannot be updated');
      }
      return po;
    }

    // When marking as received, increment stock for each product/variant
    if (status === POStatus.received) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.purchaseOrder.update({
          where: { id },
          data: { status },
          include: {
            items: true,
            supplier: { select: { id: true, companyName: true } },
            warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
          },
        });

        for (const item of next.items) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;

          const productId = item.productId;
          if (!productId) {
            throw new BadRequestException('Purchase order item is missing productId');
          }

          const lastPrice = item.unitPrice != null ? Number(item.unitPrice) : null;
          const lastCurr = (item as any).currency || po.currency || null;

          let variantId = item.productVariantId;
          if (!variantId) {
            const variant = await tx.productVariant.findFirst({
              where: { productId },
              select: { id: true },
            });
            if (!variant) {
              throw new BadRequestException(
                `Product ${productId} has no variant to receive stock against`,
              );
            }
            variantId = variant.id;
          }

          await tx.productVariant.update({
            where: { id: variantId },
            data: {
              stockOnHand: { increment: qty },
              lastPurchasePrice: lastPrice ?? undefined,
              lastPurchaseCurr: lastCurr ?? undefined,
            },
          });

          // Always update parent with the latest purchase snapshot (covers simple and variant products)
          await tx.product.update({
            where: { id: productId },
            data: {
              lastPurchasePrice: lastPrice ?? undefined,
              lastPurchaseCurr: lastCurr ?? undefined,
            },
          });
        }

        return next;
      });

      return updated;
    }

    // Other status transitions allowed (except from received)
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status, notes: notes !== undefined ? notes : undefined },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
      },
    });
  }

  async receiveItems(tenantId: string, id: string, dto: ReceivePurchaseOrderItemsDto) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
      },
    });

    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === POStatus.received) {
      throw new BadRequestException('Purchase order is already fully received');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update items and stock
      for (const receiveItem of dto.items) {
        const poItem = po.items.find((i) => i.id === receiveItem.itemId);
        if (!poItem) {
          throw new BadRequestException(`Item ${receiveItem.itemId} not found in this PO`);
        }

        const newReceivedQty = poItem.receivedQty + receiveItem.receivedQty;
        if (newReceivedQty > poItem.quantity) {
          throw new BadRequestException(
            `Cannot receive more than ordered quantity for item ${poItem.productId || 'unknown'}`,
          );
        }

        // Update PO Item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: newReceivedQty },
        });

        // Update Stock
        if (poItem.productId) {
          let variantId = poItem.productVariantId;
          if (!variantId) {
            // Fallback: find first variant if not specified (shouldn't happen in strict mode but good for safety)
            const variant = await tx.productVariant.findFirst({
              where: { productId: poItem.productId },
              select: { id: true },
            });
            if (variant) variantId = variant.id;
          }

          if (variantId) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: {
                stockOnHand: { increment: receiveItem.receivedQty },
                lastPurchasePrice: poItem.unitPrice ?? undefined,
                lastPurchaseCurr: poItem.currency || po.currency || undefined,
              },
            });

            // Create inventory transaction to track stock movement by warehouse
            await tx.inventoryTxn.create({
              data: {
                tenantId,
                productId: poItem.productId,
                productVariantId: variantId,
                warehouseId: po.warehouseId,
                qtyDelta: receiveItem.receivedQty,
                state: 'ON_HAND',
                type: 'PO_RECEIVED',
                reason: `Received from PO ${po.poNumber}`,
                refType: 'PO',
                refId: id,
                createdByUserId: null, // Can be populated if you have userId in context
              },
            });

            // Update parent product snapshot
            await tx.product.update({
              where: { id: poItem.productId },
              data: {
                lastPurchasePrice: poItem.unitPrice ?? undefined,
                lastPurchaseCurr: poItem.currency || po.currency || undefined,
              },
            });
          }
        }
      }

      // 2. Recalculate PO Status
      // Fetch fresh items to check total received status
      const freshItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allReceived = freshItems.every((i) => i.receivedQty >= i.quantity);
      const someReceived = freshItems.some((i) => i.receivedQty > 0);

      let newStatus = po.status;
      if (allReceived) {
        newStatus = POStatus.received;
      } else if (someReceived) {
        newStatus = POStatus.partially_received;
      }

      if (newStatus !== po.status) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      if (dto.amountPaid !== undefined) {
        const currentPo = await tx.purchaseOrder.findUnique({ where: { id } });
        const totalAmount = Number(currentPo?.totalAmount) || 0;
        if (dto.amountPaid > totalAmount) {
          throw new BadRequestException(`Amount paid cannot exceed total amount (${totalAmount})`);
        }
        await tx.purchaseOrder.update({
          where: { id },
          data: { amountPaid: dto.amountPaid },
        });
      }

      return tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          supplier: { select: { id: true, companyName: true } },
          warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
        },
      });
    });

    return updated;
  }

  private async ensureExists(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
  }

  private async generatePoNumber(tenantId: string) {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const candidate = `PO-${year}-${suffix}`;
      const exists = await this.prisma.purchaseOrder.findFirst({
        where: { tenantId, poNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return `PO-${year}-${Date.now()}`;
  }

  async update(tenantId: string, userId: string | null, id: string, dto: CreatePurchaseOrderDto) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Purchase order not found');
    if (existing.status === POStatus.received) {
      throw new BadRequestException('Received purchase orders cannot be edited');
    }

    const [supplier, warehouse, tenant] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, isActive: true },
        select: { id: true, currency: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId, isActive: true },
        select: { id: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { currency: true },
      }),
    ]);

    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const distinctProductIds = [...new Set(dto.items.map((i) => i.productId).filter(Boolean))];
    if (distinctProductIds.length === 0) {
      throw new BadRequestException('Each line must reference a product');
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: distinctProductIds } },
      select: { id: true },
    });
    if (products.length !== distinctProductIds.length) {
      throw new NotFoundException('One or more products are invalid or unavailable for this tenant');
    }

    const currency = (dto.currency || supplier.currency || tenant?.currency || 'USD').toUpperCase();

    let subtotal = 0;
    let productTax = 0;

    const itemsData: Prisma.PurchaseOrderItemCreateManyPurchaseOrderInput[] = dto.items.map((item) => {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantity must be at least 1');
      }

      const unitPrice = Number(item.unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException('Each line item requires a unit price greater than zero');
      }

      const taxRate = item.taxRate != null ? Number(item.taxRate) : 0;
      if (!Number.isFinite(taxRate) || taxRate < 0) {
        throw new BadRequestException('Tax rate cannot be negative');
      }

      const lineSubtotal = quantity * unitPrice;
      const taxAmount = lineSubtotal * (taxRate / 100);

      subtotal += lineSubtotal;
      productTax += taxAmount;

      return {
        productId: item.productId,
        productVariantId: item.productVariantId || undefined,
        quantity,
        unitPrice,
        currency,
        taxRate,
        taxAmount,
        notes: item.notes || undefined,
      };
    });

    const shippingCost = Number(dto.shippingCost ?? 0) || 0;
    const shippingTax = Number(dto.shippingTax ?? 0) || 0;
    const totalAmount = subtotal + productTax + shippingCost + shippingTax;

    const expectedDate = dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null;
    if (dto.expectedDeliveryDate && (!expectedDate || Number.isNaN(expectedDate.getTime()))) {
      throw new BadRequestException('Expected delivery date is invalid');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          expectedDeliveryDate: expectedDate,
          notes: dto.notes || null,
          currency,
          subtotal,
          productTax,
          shippingCost,
          shippingTax,
          totalAmount,
          amountPaid: dto.amountPaid || 0,
          status: dto.status || undefined,
          updatedAt: new Date(),
          items: {
            createMany: {
              data: itemsData,
            },
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              productVar: { select: { id: true, sku: true, sizeText: true, colorText: true } },
            },
          },
          supplier: { select: { id: true, companyName: true } },
          warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
        },
      });

      return po;
    });

    return updated;
  }

  async updatePayment(tenantId: string, id: string, amountPaid: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    const totalAmount = Number(po.totalAmount) || 0;
    if (amountPaid > totalAmount) {
      throw new BadRequestException(`Amount paid cannot exceed total amount (${totalAmount})`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { amountPaid },
      include: {
        items: true,
        supplier: { select: { id: true, companyName: true } },
        warehouse: { select: { id: true, name: true, code: true, city: true, address1: true, address2: true, state: true, zipCode: true, country: true } },
      },
    });
  }
}
