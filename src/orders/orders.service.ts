import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

export interface CreateOrderItemDto {
    productId?: string;
    productVariantId?: string;
    productDescription?: string;
    sizeId?: string;
    colorId?: string;
    categoryId?: string;
    quantity: number;
    unitCost: number | string;
    unitPrice: number | string;
    otherFee?: number | string;
}

export interface CreateOrderDto {
    date?: string;
    orderId?: string;
    tenantChannelId?: string;  // Marketplace channel
    courierMediumId?: string;

    // Multi-product support
    items?: CreateOrderItemDto[];

    // Legacy fields (optional support for single-item payloads)
    productId?: string;
    productVariantId?: string;
    productDescription?: string;
    sizeId?: string;
    colorId?: string;
    categoryId?: string;
    quantity?: number;
    costPrice?: number | string;
    otherFee?: number | string;
    totalAmount?: number | string; // treated as total sale price if single item

    trackingId?: string;
    status?: OrderStatus;
    remarkTypeId?: string;
    remarks?: string;
}

export interface UpdateOrderDto extends Partial<CreateOrderDto> { }

export interface OrderFilterDto {
    search?: string;
    status?: OrderStatus | 'ALL';
    startDate?: string;
    endDate?: string;
    mediumId?: string;
    courierId?: string;
    remarkTypeId?: string;
    dateType?: 'order' | 'created';
}

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    // =================
    // Orders CRUD
    // =================

    async createOrder(tenantId: string, dto: CreateOrderDto) {
        try {
            // 1. Prepare Items
            let itemsToCreate: CreateOrderItemDto[] = [];

            if (dto.items && dto.items.length > 0) {
                itemsToCreate = dto.items;
            } else if (dto.quantity) {
                // Fallback: Construct item from legacy single-product fields
                // If totalAmount is provided, we treat it as the total sale price.
                // For a single item line, unitPrice = totalAmount / quantity. 
                // However, usually UI sends unitPrice. Let's assume totalAmount is sale price.
                const qty = Number(dto.quantity || 1);
                const totalSale = Number(dto.totalAmount || 0);
                const unitPrice = qty > 0 ? totalSale / qty : 0;

                itemsToCreate.push({
                    productId: dto.productId,
                    productVariantId: dto.productVariantId,
                    productDescription: dto.productDescription || '',
                    sizeId: dto.sizeId,
                    colorId: dto.colorId,
                    categoryId: dto.categoryId,
                    quantity: qty,
                    unitCost: dto.costPrice || 0,
                    unitPrice: unitPrice,
                    otherFee: dto.otherFee || 0,
                });
            }

            // 2. Calculate Order Totals
            let orderTotalCost = new Prisma.Decimal(0);
            let orderTotalAmount = new Prisma.Decimal(0);
            let orderNetProfit = new Prisma.Decimal(0);

            const prismaItems = itemsToCreate.map(item => {
                const qty = new Prisma.Decimal(item.quantity || 1);
                const cost = new Prisma.Decimal(item.unitCost || 0);
                const price = new Prisma.Decimal(item.unitPrice || 0);
                const fee = new Prisma.Decimal(item.otherFee || 0);

                const lineTotalCost = cost.mul(qty);
                const lineTotalAmount = price.mul(qty);
                const lineNetProfit = lineTotalAmount.minus(lineTotalCost);

                orderTotalCost = orderTotalCost.add(lineTotalCost);
                orderTotalAmount = orderTotalAmount.add(lineTotalAmount);
                orderNetProfit = orderNetProfit.add(lineNetProfit);

                return {
                    productId: item.productId,
                    productVariantId: item.productVariantId,
                    productDescription: item.productDescription,
                    sizeId: item.sizeId,
                    colorId: item.colorId,
                    categoryId: item.categoryId,
                    quantity: item.quantity,
                    unitCost: cost,
                    unitPrice: price,
                    otherFee: fee, // Storing what was sent
                    totalCost: lineTotalCost,
                    totalAmount: lineTotalAmount,
                    netProfit: lineNetProfit
                };
            });

            // 3. Create Order and Deduct Stock (in Transaction)
            return await this.prisma.$transaction(async (tx) => {
                // 3a. Create Order
                const order = await tx.order.create({
                    data: {
                        tenantId,
                        date: dto.date ? new Date(dto.date) : new Date(),
                        orderId: dto.orderId,
                        tenantChannelId: dto.tenantChannelId,
                        courierMediumId: dto.courierMediumId,

                        // Store aggregates
                        totalCost: orderTotalCost,
                        totalAmount: orderTotalAmount,
                        netProfit: orderNetProfit,

                        // Legacy fields (optional, set first item's details for compatibility)
                        ...(itemsToCreate.length > 0 ? {
                            productId: itemsToCreate[0].productId,
                            productVariantId: itemsToCreate[0].productVariantId,
                            productDescription: itemsToCreate[0].productDescription,
                            quantity: itemsToCreate.reduce((sum, i) => sum + Number(i.quantity), 0),
                        } : {}),

                        trackingId: dto.trackingId,
                        status: dto.status || OrderStatus.LABEL_PRINTED,
                        remarks: dto.remarks,
                        remarkTypeId: dto.remarkTypeId,

                        items: {
                            create: prismaItems
                        }
                    },
                    include: {
                        tenantChannel: true,
                        courierMedium: true,
                        items: {
                            include: {
                                product: { include: { images: true } },
                                productVariant: true,
                                size: true,
                                color: true,
                                category: true,
                            }
                        },
                        remarkType: true,
                        attachments: true,
                    },
                });

                // 3b. Deduct Stock for each item (only ProductVariant has stockOnHand)
                for (const item of itemsToCreate) {
                    const qtyToDeduct = Number(item.quantity) || 0;
                    if (qtyToDeduct <= 0) continue;

                    // Only ProductVariant has stockOnHand field
                    if (item.productVariantId) {
                        await tx.productVariant.update({
                            where: { id: item.productVariantId },
                            data: { stockOnHand: { decrement: qtyToDeduct } }
                        });
                    }
                    // Note: Product model doesn't have stockOnHand - stock is tracked on variants only
                }

                return order;
            });
        } catch (error) {
            const e = error as any;
            if (e.code === 'P2002' && e.meta?.target?.includes('orderId')) {
                throw new ConflictException('Order ID already exists');
            }
            throw error;
        }
    }

    async getOrders(tenantId: string, filters: OrderFilterDto & { page?: number; perPage?: number }) {
        const where: Prisma.OrderWhereInput = { tenantId };

        if (filters.search) {
            where.OR = [
                { orderId: { contains: filters.search } },
                { productDescription: { contains: filters.search } },
                { trackingId: { contains: filters.search } },
                { remarks: { contains: filters.search } },
                // Also search in items?
                { items: { some: { productDescription: { contains: filters.search } } } }
            ];
        }

        if (filters.status && filters.status !== 'ALL') {
            where.status = filters.status;
        }

        if (filters.startDate || filters.endDate) {
            const dateField = filters.dateType === 'created' ? 'createdAt' : 'date';

            where[dateField] = {};
            if (filters.startDate) where[dateField].gte = new Date(filters.startDate);
            if (filters.endDate) {
                // Ensure end date covers the full day if it's just a generated YYYY-MM-DD
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                where[dateField].lte = end;
            }
        }

        if (filters.mediumId) where.tenantChannelId = filters.mediumId;
        if (filters.courierId) where.courierMediumId = filters.courierId;
        if (filters.remarkTypeId) where.remarkTypeId = filters.remarkTypeId;

        // Pagination
        const page = Number(filters.page || 1);
        const perPage = Number(filters.perPage || 25);
        const skip = (page - 1) * perPage;

        const [total, rows] = await Promise.all([
            this.prisma.order.count({ where }),
            this.prisma.order.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: perPage,
                include: {
                    tenantChannel: true,
                    courierMedium: true,
                    items: {
                        include: {
                            product: { include: { images: true } },
                            productVariant: true,
                            size: true,
                            color: true,
                            category: true,
                        }
                    },
                    // Include legacy for now if needed, but UI should switch to items
                    product: { include: { images: true } },
                    productVariant: true,
                    size: true,
                    color: true,
                    category: true,
                    remarkType: true,
                    attachments: true,
                },
            })
        ]);

        return {
            rows,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage)
            }
        };
    }

    async getCounts(tenantId: string) {
        const grouped = await this.prisma.order.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: {
                status: true,
            },
        });

        const counts: Record<string, number> = {};
        let total = 0;
        grouped.forEach(g => {
            counts[g.status] = g._count.status;
            total += g._count.status;
        });
        counts['ALL'] = total;

        // Ensure all statuses present
        Object.values(OrderStatus).forEach(status => {
            if (!counts[status]) counts[status] = 0;
        });

        return counts;
    }

    async updateOrder(tenantId: string, id: string, dto: UpdateOrderDto) {
        try {
            const existing = await this.prisma.order.findFirst({ where: { id, tenantId }, include: { items: true } });
            if (!existing) throw new NotFoundException('Order not found');

            // If new items are provided, replace them all (simplest strategy for now)
            // Or if legacy fields provided, update single item logic?
            // For Safety: if `items` is provided, we delete old items and create new ones.
            // If `items` NOT provided, but legacy fields ARE, we update the main fields and maybe sync to first item?
            // This is complex. Let's assume if frontend sends `items`, it sends the FULL list.

            let data: any = { ...dto };
            if (dto.date) data.date = new Date(dto.date);

            // Removing items from data to handle manually
            delete data.items;

            if (dto.items) {
                // Multi-item update strategy: Replace all items
                // 1. Delete existing items
                // 2. Create new items

                // Recalculate totals
                let orderTotalCost = new Prisma.Decimal(0);
                let orderTotalAmount = new Prisma.Decimal(0);
                let orderNetProfit = new Prisma.Decimal(0);

                const prismaItemsCreate = dto.items.map(item => {
                    const qty = new Prisma.Decimal(item.quantity || 1);
                    const cost = new Prisma.Decimal(item.unitCost || 0);
                    const price = new Prisma.Decimal(item.unitPrice || 0);
                    const fee = new Prisma.Decimal(item.otherFee || 0);

                    const lineTotalCost = cost.mul(qty);
                    const lineTotalAmount = price.mul(qty);
                    const lineNetProfit = lineTotalAmount.minus(lineTotalCost);

                    orderTotalCost = orderTotalCost.add(lineTotalCost);
                    orderTotalAmount = orderTotalAmount.add(lineTotalAmount);
                    orderNetProfit = orderNetProfit.add(lineNetProfit);

                    return {
                        productId: item.productId,
                        productVariantId: item.productVariantId,
                        productDescription: item.productDescription,
                        sizeId: item.sizeId,
                        colorId: item.colorId,
                        categoryId: item.categoryId,
                        quantity: item.quantity,
                        unitCost: cost,
                        unitPrice: price,
                        otherFee: fee,
                        totalCost: lineTotalCost,
                        totalAmount: lineTotalAmount,
                        netProfit: lineNetProfit
                    };
                });

                // Update Order Data
                data.totalCost = orderTotalCost;
                data.totalAmount = orderTotalAmount;
                data.netProfit = orderNetProfit;

                return await this.prisma.$transaction(async (tx) => {
                    await tx.orderItem.deleteMany({ where: { orderId: id } });
                    return await tx.order.update({
                        where: { id },
                        data: {
                            ...data,
                            items: {
                                create: prismaItemsCreate
                            }
                        },
                        include: {
                            tenantChannel: true,
                            courierMedium: true,
                            items: {
                                include: {
                                    product: { include: { images: true } },
                                    productVariant: true,
                                    size: true,
                                    color: true,
                                    category: true,
                                }
                            },
                            remarkType: true,
                            attachments: true,
                        },
                    });
                });
            } else {
                // Legacy Update: User sent legacy fields (quantity, costPrice, etc.)
                // We should update the Order aggregates
                // AND potentially update the first item if it exists? or all items?
                // This is risky. Let's just update the Order fields as requested for now. 
                // BUT if we switched to items, updating Order fields alone desyncs them.
                // Assuming Frontend hasn't adopted items yet, it sends legacy fields.
                // We should update the aggregates.
                // And ideally update the legacy columns on Order table (which we are doing via `data`).

                // Wait, if we use legacy columns, `netProfit` and `totalCost` need calculation.
                // Use code from previous version for fallback
                const qty = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : existing.quantity;
                const cost = dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : existing.costPrice;
                const sale = dto.totalAmount !== undefined ? new Prisma.Decimal(dto.totalAmount) : existing.totalAmount;

                const qtyVal = Number(qty);
                const costDec = new Prisma.Decimal(cost);
                const saleDec = new Prisma.Decimal(sale);

                const totalCost = costDec.mul(qtyVal);
                const netProfit = saleDec.minus(totalCost);

                data.totalCost = totalCost;
                data.netProfit = netProfit;

                return await this.prisma.order.update({
                    where: { id },
                    data,
                    include: {
                        tenantChannel: true,
                        courierMedium: true,
                        items: {
                            include: {
                                product: { include: { images: true } },
                                productVariant: true,
                                size: true,
                                color: true,
                                category: true,
                            }
                        },
                        remarkType: true,
                        attachments: true,
                    },
                });
            }
        } catch (error) {
            const e = error as any;
            if (e.code === 'P2002' && e.meta?.target?.includes('orderId')) {
                throw new ConflictException('Order ID already exists');
            }
            throw error;
        }
    }

    async deleteOrder(tenantId: string, id: string) {
        const existing = await this.prisma.order.findFirst({ where: { id, tenantId } });
        if (!existing) throw new NotFoundException('Order not found');
        return this.prisma.order.delete({ where: { id } });
    }

    // =================
    // Helpers (Color, Size, Category)
    // =================

    async getColors(tenantId: string) {
        return this.prisma.color.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }

    async createColor(tenantId: string, name: string, code?: string) {
        return this.prisma.color.create({
            data: { tenantId, name, code },
        });
    }

    async createSize(tenantId: string, code: string, name?: string) {
        return this.prisma.size.create({
            data: { tenantId, code, name: name || code },
        });
    }

    async createCategory(tenantId: string, name: string) {
        return this.prisma.category.create({
            data: { tenantId, name },
        });
    }

    // =================
    // Attachments
    // =================

    async addAttachment(tenantId: string, orderId: string, file: Express.Multer.File) {
        // Verify order exists and belongs to tenant
        const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order) throw new NotFoundException('Order not found');

        return this.prisma.orderAttachment.create({
            data: {
                orderId,
                fileName: file.originalname,
                // We serve static files from /uploads, so path is relative like 'orders/filename' or just '/uploads/orders/filename'
                // Controller saved to ./uploads/orders, so path is /uploads/orders/filename
                filePath: `/uploads/orders/${file.filename}`,
                fileSize: file.size,
                mimeType: file.mimetype,
            },
        });
    }

    async deleteAttachment(tenantId: string, orderId: string, attachmentId: string) {
        const attachment = await this.prisma.orderAttachment.findFirst({
            where: { id: attachmentId, orderId, order: { tenantId } },
        });
        if (!attachment) throw new NotFoundException('Attachment not found');

        // Delete from DB
        await this.prisma.orderAttachment.delete({ where: { id: attachmentId } });

        // Try delete from disk
        try {
            // filePath is /uploads/orders/filename. Relative to CWD is ./uploads/orders/filename
            // Assuming CWD is project root.
            const fullPath = `.${attachment.filePath}`;
            const fs = require('fs/promises');
            await fs.unlink(fullPath);
        } catch (e) {
            console.error('Failed to delete file from disk', e);
            // Ignore error, record is gone
        }

        return { success: true };
    }
}
