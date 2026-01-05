import React, { useEffect, useRef, useState } from 'react';
import { Container, Grid, Paper, Typography, Button, Box, Breadcrumbs, IconButton, Divider } from '@mui/material';
import { useSelector, useStore } from 'react-redux';
import { add_list_item_in_cart, change_is_loading, set_number_cart } from '../../../reducers/Actions';
import { GetGuestApi, PostGuestApi } from '../../../untils/Api';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeIcon from '@mui/icons-material/Home';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { addCheckout, addCheckoutBuyAll, addToListCartStore, formatPrice, toastSuccess } from '../../../untils/Logic';
import SizeGuideDialog from './SizeGuideDialog';
import { HOST_BE } from '../../../common/Common';
import RelatedProducts from '../../../components/user-guest/home/RelatedProduct';
import { ReducerProps } from '../../../reducers/ReducersProps';
import { AlertLogin } from '../../../components/alert/Alert';
import { socket_IO_Client } from '../../../routes/MainRoutes';

const ProductDetail: React.FC = () => {
    const { productId } = useParams();
    const user = useSelector((state: ReducerProps) => state.user);

    const [product, setProduct] = useState<any>(undefined);
    const [selectedProductDetail, setSelectedProductDetail] = useState<any>(undefined);
    const [productDetails, setProductDetails] = useState<any>(undefined);
    const [quantity, setQuantity] = useState<number>(1);
    const store = useStore();
    const nav = useNavigate();
    const [selectedImage, setSelectedImage] = useState('');
    const [openDialog, setOpenDialog] = useState(false);

    const handleOpenDialog = () => {
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };
    const checkEngagement = async () => {
        try {
            const deviceId = window.SalesforceInteractions.getAnonymousId();
            const resProduct = await PostGuestApi(`/api/check-web-engagement`, {
                deviceId: deviceId,
                productId: productId,
            });
        } catch (error) {
            toast.error('Lỗi');
        } finally {
            store.dispatch(change_is_loading(false));
        }
    };
    const getData = async () => {
        store.dispatch(change_is_loading(true));
        try {
            const resProduct = await GetGuestApi(`/api/product/${productId}`);
            if (resProduct.data.message === 'Success') {
                setProduct(resProduct.data.product);
                setSelectedImage(resProduct.data.product.imageList[0]);
            }
            const resProductDetails = await GetGuestApi(`/api/product-detail-by-product/${productId}`);
            if (resProductDetails.data.message === 'Success') {
                setProductDetails(resProductDetails.data.productDetails);
                setSelectedProductDetail(resProductDetails.data.productDetails[0]);
            }
        } catch (error) {
            toast.error('Lỗi');
        } finally {
            store.dispatch(change_is_loading(false));
        }
    };

    const handleAddToCart = () => {
        const isJibbitz = product?.categoryId === '67b81eb6fb30030990a31918';
        addToListCartStore(selectedProductDetail.id, quantity, selectedProductDetail, false, isJibbitz);
        store.dispatch(set_number_cart(quantity));
        store.dispatch(add_list_item_in_cart(selectedProductDetail));
        toastSuccess('Thêm vào giỏ hàng thành công');
    };
    const handleBuyNow = async () => {
        const deviceId = window.SalesforceInteractions.getAnonymousId();
        const res = await PostGuestApi('/api/write-log-order', { deviceId: deviceId, productId: productId });
        if (res.data.message == 'success') {
            window.SalesforceInteractions.sendEvent({
                interaction: {
                    name: 'View Catalog Object',
                    catalogObject: {
                        type: 'Order',
                        pageView: 'Product',
                        id: productId,
                        dateTime: new Date().toISOString(),
                    },
                },
            });
            const isJibbitz = product?.categoryId === '67b81eb6fb30030990a31918';
            addToListCartStore(selectedProductDetail.id, quantity, selectedProductDetail, true, isJibbitz);
            store.dispatch(set_number_cart(quantity));
            store.dispatch(add_list_item_in_cart(selectedProductDetail));
            addCheckoutBuyAll();
            nav('/checkout');
        }
    };
    const [showCoupon, setShowCoupon] = useState(false);
    const [timeLeft, setTimeLeft] = useState(15 * 60);
    const timerRef = useRef<any>(null);
    const formatTime = (seconds: any) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const [showProduct, setShowProduct] = useState(false);
    const [timeLeftProduct, setTimeLeftProduct] = useState(15 * 60);
    const timerRefProduct = useRef<any>(null);
    const [productRelate, setProductRelate] = useState<any>();
    const triggerCouponOffer = () => {
        setShowCoupon(true);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setShowCoupon(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };
    const triggerProductOffer = (data: any) => {
        setProductRelate(data);
        setShowProduct(true);
        timerRef.current = setInterval(() => {
            setTimeLeftProduct((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setShowProduct(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        getData();
        const trackingProduct = setTimeout(() => {
            window.SalesforceInteractions.sendEvent({
                interaction: {
                    name: 'View Catalog Object',
                    catalogObject: {
                        type: 'Product',
                        pageView: 'Product',
                        id: productId,
                    },
                },
            });
        }, 5 * 1000);
        return () => {
            clearTimeout(trackingProduct);
        };
    }, [productId]);
    useEffect(() => {
        checkEngagement();
        socket_IO_Client.on('reqDiscountProduct', (data) => {
            console.log(data);
            if (data === 'show-voucher') {
                triggerCouponOffer();
            } else {
                triggerProductOffer(data);
            }
        });
    }, []);
    const sortedProductDetails = [...(productDetails ? productDetails : [])].sort((a, b) => {
        const sizeAMatch = a.sizeName.match(/\d+/);
        const sizeBMatch = b.sizeName.match(/\d+/);

        const sizeA = sizeAMatch ? parseInt(sizeAMatch[0], 10) : Infinity; // Nếu không tìm thấy, coi như lớn nhất
        const sizeB = sizeBMatch ? parseInt(sizeBMatch[0], 10) : Infinity; // Nếu không tìm thấy, coi như lớn nhất

        return sizeA - sizeB;
    });
    return (
        <>
            <Container sx={{ marginTop: { xs: '210px', md: '160px' } }}>
                {showCoupon && (
                    <div className="fixed bottom-5 right-5 bg-red-600 text-white p-6 rounded-lg shadow-2xl animate-bounce-in z-50">
                        <h3 className="text-xl font-bold">🎁 Ưu đãi đặc biệt!</h3>
                        <p>
                            Bạn đang phân vân? Giảm ngay <strong>10%</strong> nếu mua ngay.
                        </p>

                        <div className="my-3 text-2xl font-mono bg-white text-red-600 px-3 py-1 rounded text-center">
                            FLASH10
                        </div>

                        <p className="text-sm">
                            Ưu đãi kết thúc sau: <strong>{formatTime(timeLeft)}</strong>
                        </p>

                        <button
                            onClick={() => (window.location.href = '/checkout?code=FLASH10')}
                            className="mt-3 w-full bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 transition"
                        >
                            MUA NGAY KẺO LỠ
                        </button>
                    </div>
                )}
                {showProduct && productRelate && (
                    <div className="fixed bottom-5 right-5 bg-red-600 text-white p-6 rounded-lg shadow-2xl animate-bounce-in z-50">
                        <h3 className="text-xl font-bold">🎁 Ưu đãi đặc biệt!</h3>

                        <div className="my-3 text-2xl font-mono bg-white text-red-600 px-3 py-1 rounded text-center">
                            Sản Phẩm Hot
                        </div>

                        <button
                            onClick={() => (window.location.href = `/product/${productRelate[0].productid__c}`)}
                            className="mt-3 w-full bg-yellow-400 text-black font-bold py-2 rounded hover:bg-yellow-300 transition"
                        >
                            Xem Thêm Sản Phẩm
                        </button>
                    </div>
                )}
                <Box sx={{ paddingTop: { xs: '0px', md: '10px' } }}>
                    <Breadcrumbs separator="›" aria-label="breadcrumb">
                        <IconButton href="/">
                            <HomeIcon fontSize="small" />
                        </IconButton>
                        <Typography color="textPrimary" fontSize={13} fontWeight={520}>
                            {product?.categoryName}
                        </Typography>
                        <Typography color="textPrimary" fontSize={13}>
                            {product?.name}
                        </Typography>
                    </Breadcrumbs>
                </Box>
                <Grid container spacing={2} mt={0} mb={2}>
                    {/* Phần bên trái */}
                    <Grid
                        item
                        xs={12}
                        md={6}
                        sx={{ display: 'flex', flexDirection: { md: 'row', xs: 'column-reverse' } }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { md: 'column', xs: 'row' },
                                maxHeight: '510px',
                                minHeight: '120px',
                                overflowY: { md: 'auto', xs: 'hidden' },
                                overflowX: { xs: 'auto' },
                                mr: { md: 2, xs: 0 },
                                mt: { md: 0, xs: 2 },
                                flexGrow: 1,
                            }}
                        >
                            {product?.imageList?.map((image: any, index: number) => (
                                <Box key={index} sx={{ mb: { xs: 0, md: 1 }, mr: { xs: 1, md: 0 }, flex: '0 0 auto' }}>
                                    <img
                                        src={image.startsWith('uploads') ? `${HOST_BE}/${image}` : image}
                                        alt={product.name}
                                        onClick={() => setSelectedImage(image)}
                                        style={{
                                            height: 'auto',
                                            width: '100px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            border:
                                                selectedImage === image
                                                    ? '2px solid rgba(7, 110, 145, 0.89)'
                                                    : '1px solid rgba(99, 120, 127, 0.89)',
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                            <img
                                src={
                                    selectedImage.startsWith('uploads') ? `${HOST_BE}/${selectedImage}` : selectedImage
                                }
                                alt={product?.name}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '510px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                }}
                            />
                        </Box>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Box sx={{ pl: '16px', pr: '16px', pt: '2px', height: '100%' }}>
                            <Typography variant="h4" fontSize={28} sx={{ mb: 0 }}>
                                {product?.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgb(17, 189, 72)' }}>
                                {'★★★★★'}
                            </Typography>
                            <Box display="flex" alignItems="center" style={{ margin: '16px 0' }}>
                                <Typography
                                    variant="body2"
                                    style={{
                                        color: 'red',
                                        fontSize: 16,
                                        marginRight: '16px',
                                    }}
                                >
                                    {formatPrice(product?.sellPrice)}
                                </Typography>
                                {product?.virtualPrice > 0 && (
                                    <Typography
                                        variant="h5"
                                        style={{
                                            margin: '0',
                                            textDecoration: 'line-through',
                                            color: 'gray',
                                            fontSize: 16,
                                        }}
                                    >
                                        {formatPrice(product?.virtualPrice)}
                                    </Typography>
                                )}
                            </Box>
                            <Divider></Divider>
                            <Typography variant="h5" sx={{ mt: 1, mb: 1, fontSize: 16, fontWeight: 'bold' }}>
                                Màu sắc: {product?.colorName}
                            </Typography>
                            <Divider></Divider>
                            <Box display="flex" alignItems="center" justifyContent="space-between" mt={2}>
                                <Typography variant="h5" sx={{ mt: 1, mb: 1, fontSize: 16, fontWeight: 'bold' }}>
                                    Kích thước:
                                </Typography>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        color: 'rgb(172, 0, 207)',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        fontWeight: 'bold',
                                        fontSize: 16,
                                    }}
                                    onClick={handleOpenDialog}
                                >
                                    Hướng dẫn chọn kích thước
                                </Typography>
                            </Box>
                            <SizeGuideDialog open={openDialog} onClose={handleCloseDialog} />

                            <Box display="flex" flexWrap="wrap" mt={1}>
                                {sortedProductDetails?.map((productDetail: any) => (
                                    <Button
                                        key={productDetail.sizeName}
                                        variant="outlined"
                                        sx={{
                                            margin: '4px',
                                            minWidth: '95px',
                                            height: '36px',
                                            px: 1,
                                            backgroundColor:
                                                selectedProductDetail === productDetail
                                                    ? 'rgba(7, 110, 145, 0.89)'
                                                    : 'transparent',
                                            color: selectedProductDetail === productDetail ? 'white' : 'inherit',
                                            border:
                                                selectedProductDetail === productDetail
                                                    ? '1px solid rgba(7, 110, 145, 0.89)'
                                                    : '1px solid rgba(99, 120, 127, 0.89)',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            fontWeight: '700',
                                            transition: 'background-color 0.3s, color 0.3s, border 0.3s',
                                            '&:hover': {
                                                backgroundColor:
                                                    selectedProductDetail === productDetail
                                                        ? 'rgba(7, 110, 145, 0.7)'
                                                        : 'rgba(99, 120, 127, 0.1)',
                                                border: '1px solid rgba(7, 110, 145, 0.89)',
                                            },
                                        }}
                                        onClick={() => setSelectedProductDetail(productDetail)}
                                    >
                                        {productDetail.sizeName}
                                    </Button>
                                ))}
                            </Box>
                            {selectedProductDetail && (
                                <Typography
                                    variant="h6"
                                    style={{
                                        marginTop: '16px',
                                        color: selectedProductDetail.quantity < 10 ? 'orange' : 'green',
                                        fontWeight: 'bold',
                                        fontSize: 17,
                                    }}
                                >
                                    Còn lại: {selectedProductDetail.quantity} sản phẩm
                                </Typography>
                            )}
                            <Box display="flex" alignItems="center" mt={2}>
                                <LocalShippingOutlinedIcon style={{ marginRight: '8px' }} />
                                <Typography variant="h4" sx={{ fontSize: 17, fontWeight: 'bold' }}>
                                    Giao hàng tận nơi
                                </Typography>
                            </Box>
                            <Box mt={2}>
                                <Box display="flex" alignItems="center">
                                    <Button
                                        variant="outlined"
                                        style={{
                                            margin: '1px',
                                            border: '1px solid gray',
                                            backgroundColor: 'white',
                                            width: '40px',
                                            height: '40px',
                                            fontSize: '20px',
                                            color: 'gray',
                                            padding: 0,
                                        }}
                                        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                                    >
                                        -
                                    </Button>
                                    <input
                                        value={quantity.toString()}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={() => {
                                            if (quantity === 0) {
                                                setQuantity(1);
                                            } else if (quantity > selectedProductDetail.quantity) {
                                                setQuantity(selectedProductDetail.quantity);
                                            }
                                        }}
                                        style={{
                                            width: '50px',
                                            height: '40px',
                                            textAlign: 'center',
                                            border: '1px solid gray',
                                            borderRadius: '4px',
                                            margin: '1px',
                                            padding: '8px',
                                        }}
                                        onChange={(e: any) => {
                                            const value = e.target.value;
                                            // Chỉ cho phép nhập số
                                            if (/^\d*$/.test(value) || value === '') {
                                                setQuantity(value === '' ? 0 : parseInt(value)); // Lưu giá trị là số
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        style={{
                                            margin: '1px',
                                            border: '1px solid gray',
                                            backgroundColor: 'white',
                                            width: '40px',
                                            height: '40px',
                                            fontSize: '20px',
                                            color: 'gray',
                                            padding: 0,
                                        }}
                                        onClick={() =>
                                            setQuantity((prev) => Math.min(selectedProductDetail.quantity, prev + 1))
                                        }
                                    >
                                        +
                                    </Button>
                                </Box>
                            </Box>
                            <Box mt={2} display="flex">
                                <Button
                                    variant="outlined"
                                    style={{
                                        borderColor: 'rgb(7, 110, 145)',
                                        color: 'rgb(7, 110, 145)',
                                        backgroundColor: 'white',
                                        width: '210px',
                                        height: '55px',
                                        marginRight: '8px',
                                    }}
                                    onClick={() => {
                                        handleAddToCart();
                                    }}
                                >
                                    Thêm vào giỏ
                                </Button>
                                <Button
                                    variant="contained"
                                    style={{
                                        backgroundColor: 'rgb(7, 110, 145)',
                                        color: 'white',
                                        width: '210px',
                                        height: '55px',
                                    }}
                                    onClick={() => {
                                        if (!user.id) {
                                            AlertLogin();
                                        } else {
                                            handleBuyNow();
                                        }
                                    }}
                                >
                                    Mua ngay
                                </Button>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>

                {/* Phần thông tin chi tiết */}
                <Grid container spacing={2}>
                    <Grid item xs={12} md={9}>
                        <Paper elevation={3} sx={{ padding: '16px', mt: 2 }}>
                            <Typography variant="h5">Mô tả sản phẩm</Typography>
                            <Typography variant="body2" sx={{ mt: 2, textAlign: 'justify' }}>
                                {product?.describe}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h5">Thông số</Typography>
                            <Box sx={{ mt: 2 }}>
                                {[
                                    { label: 'Chất liệu mặt trên', value: 'Da' },
                                    { label: 'Chất liệu đế', value: 'Cao su' },
                                    { label: 'Kiểu đóng', value: 'Dây buộc' },
                                    { label: 'Trọng lượng', value: '400g' },
                                ].map((spec, index) => (
                                    <Grid container key={index} sx={{ mb: 1 }}>
                                        <Grid item xs={4}>
                                            <Paper sx={{ padding: 1, backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {spec.label}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Paper sx={{ padding: 1, backgroundColor: '#ffffff', borderRadius: '4px' }}>
                                                <Typography variant="body2">{spec.value}</Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                ))}
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h5">Hướng dẫn bảo quản</Typography>
                            <Typography variant="body2" sx={{ mb: 2, mt: 2, textAlign: 'justify' }}>
                                Chất liệu chủ yếu để tạo nên giày dép Crocs là nhựa Croslite, loại nhựa này{' '}
                                <strong>
                                    không nên để tiếp xúc trực tiếp với ánh nắng mặt trời trong thời gian dài
                                </strong>
                                . Dép Crocs của bạn có thể sẽ bị phai màu, co rút, uốn cong hoặc thậm chí bị chảy nếu
                                ánh nắng quá mạnh, ảnh hưởng đến form dáng sản phẩm.
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2, mt: 2, textAlign: 'justify' }}>
                                Nhựa rất dễ bám bẩn nhưng cũng rất dễ vệ sinh, có những vết bẩn chỉ cần lau bằng khăn
                                ướt là sạch. Vì vậy bạn nên <strong>thường xuyên vệ sinh giày dép Crocs</strong>, tránh
                                để vết bẩn bám lâu ngày.
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2, mt: 2, textAlign: 'justify' }}>
                                <strong>Không sử dụng chất tẩy quá mạnh</strong> đối với các dòng sản phẩm theo công
                                nghệ nhuộm, phun sơn như Spray Dye, Tie Dye, Solarized. Điều đó sẽ khiến sản phẩm bị bay
                                màu và không còn giữ được màu sắc như ban đầu.
                            </Typography>
                        </Paper>
                    </Grid>

                    {/* Phần chính sách đổi trả */}
                    <Grid item xs={12} md={3}>
                        <Paper elevation={3} sx={{ padding: '16px', mt: 2 }}>
                            <Typography variant="h5">TỔNG ĐÀI HỖ TRỢ</Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Hotline mua hàng: <strong>9999999999</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Hotline hỗ trợ, khiếu nại: <strong>9999999999</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Thời gian làm việc từ 8h00 - 22h00 (Thứ 2 - Chủ nhật)
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    MIỄN PHÍ GIAO HÀNG
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Free ship đơn hàng từ 500k
                                </Typography>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    ĐỔI TRẢ DỄ DÀNG
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Đổi trả miễn phí trong vòng 30 ngày
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
            <Container sx={{ mt: 2, mb: 2 }}>
                <Typography variant="h5" sx={{ mt: 2, mb: 2 }}>
                    SẢN PHẨM LIÊN QUAN
                </Typography>
                {product && <RelatedProducts categoryId={product.categoryId} />}
            </Container>
        </>
    );
};

export default ProductDetail;
