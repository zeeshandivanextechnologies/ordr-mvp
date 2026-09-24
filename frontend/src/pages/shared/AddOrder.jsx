import { useState, useEffect } from 'react';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { fetchCountries, fetchStates, fetchCities } from '../../services/locationService';
import { fetchCurrencies } from '../../services/currencyService';
import { toast } from 'react-toastify';
import '../../styles/member.css';

export default function AddOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingId = location.state?.editId || null;
  const [orderType, setOrderType] = useState('sales');
  const [lines, setLines] = useState([{ product: '', sku: '', description: '', qty: '', unit: 'MT', unitPrice: '', total: '' }]);
  const [prefillLoading, setPrefillLoading] = useState(!!editingId);

  const [formData, setFormData] = useState({
    partyName: '',
    poNumber: '',
    orderDate: '',
    requiredDeliveryDate: '',
    deliveryAddress: '',
    city: '',
    state: '',
    country: '',
    currency: 'INR'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [stateOptions, setStateOptions] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [currencies, setCurrencies] = useState(['INR', 'USD', 'AED', 'SAR']);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchCountries()
      .then((list) => {
        if (mounted) setCountries(list);
      })
      .catch(() => {
        if (mounted) setCountries([]);
      })
      .finally(() => {
        if (mounted) setCountriesLoading(false);
      });
    fetchCurrencies()
      .then((list) => {
        if (mounted) setCurrencies(list);
      })
      .catch(() => {
        if (mounted) setCurrencies(['INR', 'USD', 'AED', 'SAR']);
      })
      .finally(() => {
        if (mounted) setCurrenciesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    let mounted = true;
    api
      .get(`/orders/${editingId}`)
      .then((res) => {
        if (!mounted) return;
        const order = res.data.order;
        setOrderType(order.order_type || 'sales');
        setFormData({
          partyName: order.party_name || '',
          poNumber: order.po_number || '',
          orderDate: order.order_date || '',
          requiredDeliveryDate: order.required_delivery_date || '',
          deliveryAddress: order.delivery_address || '',
          city: order.city || '',
          state: order.state || '',
          country: order.country || '',
          currency: order.currency || 'INR',
        });
        setLines(
          (res.data.items || []).map((i) => ({
            product: i.product || '',
            sku: i.sku || '',
            description: i.description || '',
            qty: String(i.quantity ?? ''),
            unit: i.unit || 'MT',
            unitPrice: String(i.unit_price ?? ''),
            total: String(i.total ?? ''),
          }))
        );
        if (order.country) {
          fetchStates(order.country)
            .then(setStateOptions)
            .catch(() => setStateOptions([]));
        }
        if (order.country && order.state) {
          fetchCities(order.country, order.state)
            .then(setCityOptions)
            .catch(() => setCityOptions([]));
        }
      })
      .catch((err) => {
        if (mounted) {
          toast.error(err.response?.data?.message || 'Failed to load order');
          navigate('/app/orders');
        }
      })
      .finally(() => {
        if (mounted) setPrefillLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [editingId, navigate]);

  const addLine = () => {
    setLines([...lines, { product: '', sku: '', description: '', qty: '', unit: 'MT', unitPrice: '', total: '' }]);
    toast.success('Product line added');
  };
  const removeLine = (index) => {
    setLines(lines.filter((_, i) => i !== index));
    toast.info('Product line removed');
  };
  const updateLine = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    if ((field === 'qty' || field === 'unitPrice') && updated[index].qty && updated[index].unitPrice) {
      updated[index].total = (parseFloat(updated[index].qty) * parseFloat(updated[index].unitPrice)).toFixed(2);
    }
    setLines(updated);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'country') {
      setFormData((prev) => ({
        ...prev,
        country: value,
        state: '',
        city: '',
        currency: value === 'India' ? 'INR' : prev.currency,
      }));
      setStateOptions([]);
      setCityOptions([]);
      if (value) {
        setStatesLoading(true);
        fetchStates(value)
          .then(setStateOptions)
          .catch(() => setStateOptions([]))
          .finally(() => setStatesLoading(false));
      } else {
        setStatesLoading(false);
      }
    } else if (name === 'state') {
      setFormData((prev) => ({ ...prev, state: value, city: '' }));
      setCityOptions([]);
      if (value) {
        setCitiesLoading(true);
        fetchCities(formData.country, value)
          .then(setCityOptions)
          .catch(() => setCityOptions([]))
          .finally(() => setCitiesLoading(false));
      } else {
        setCitiesLoading(false);
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const currencySymbols = { INR: '₹', USD: '$', AED: 'AED', SAR: 'SAR' };
  const currencySymbol = currencySymbols[formData.currency] || formData.currency;

  const handleSaveOrder = async () => {
    if (!formData.partyName || !formData.poNumber) {
      setError('Customer/Supplier Name and PO Number are required.');
      toast.error('Customer/Supplier Name and PO Number are required.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const payload = {
        type: orderType,
        ...formData,
        items: lines
      };
      if (editingId) {
        await api.put(`/orders/${editingId}`, payload);
        toast.success('Order updated successfully');
      } else {
        await api.post('/orders', payload);
        toast.success('Order saved successfully');
      }
      navigate('/app/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save order');
      toast.error(err.response?.data?.message || 'Failed to save order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="member-page-header">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn" onClick={() => navigate('/app/orders')}> <FiArrowLeft /> <span className='back-mobile-hide'>Back </span> </button>
          <h2 className="mb-0">{editingId ? 'Edit Order' : 'Add Order'}</h2>
        </div>
      </div>
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <div className="row ">
        <div className="col-lg-8 col-md-12 col-sm-12 mb-lg-0 mb-3">
          <div className="member-card mb-3">
            <div className="member-card-header">
              <h5>Order Details</h5>
            </div>
            <div className="member-card-body">
              <div className="custom-frm-bx">
                <label className="" >Order Type</label>
                <div className="order-type-toggle">
                  <button className={`toggle-btn ${orderType === 'sales' ? 'active' : ''}`} onClick={() => setOrderType('sales')}>Sales</button>
                  <button className={`toggle-btn ${orderType === 'purchase' ? 'active' : ''}`} onClick={() => setOrderType('purchase')}>Purchase</button>
                </div>
              </div>

              <div className="row ">
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                    <label className="" > {orderType === 'sales' ? 'Customer' : 'Supplier'}</label>
                     <input type="text" className="form-control" name="partyName" value={formData.partyName} onChange={handleInputChange} placeholder={`Enter ${orderType === 'sales' ? 'Customer' : 'Supplier'} Name`} />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                     <label className="">PO / Order Number</label>
                      <input type="text" className="form-control" name="poNumber" value={formData.poNumber} onChange={handleInputChange} placeholder="e.g. PO-8192" />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                    <label className="" >Order Date</label>
                    <input type="date" className="form-control" name="orderDate" value={formData.orderDate} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                    <label className="">Required Delivery Date</label>
                     <input type="date" className="form-control" name="requiredDeliveryDate" value={formData.requiredDeliveryDate} onChange={handleInputChange} />
                  </div>
                </div>


                <div className="col-lg-12 col-md-12 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="">Delivery Address</label>
                    <input type="text" className="form-control" name="deliveryAddress" value={formData.deliveryAddress} onChange={handleInputChange} placeholder="Full delivery address" />
                  </div>
                </div>

                   <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="">Country</label>
                    <select className="form-select" name="country" value={formData.country} onChange={handleInputChange} disabled={countriesLoading}>
                      <option value="">{countriesLoading ? 'Loading countries...' : 'Select Country'}</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

             

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                    <label className="">State</label>
                    {statesLoading ? (
                      <select className="form-select" name="state" value={formData.state} disabled>
                        <option value="">Loading states...</option>
                      </select>
                    ) : stateOptions.length > 0 ? (
                      <select
                        className="form-select"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        disabled={!formData.country}
                      >
                        <option value="">Select State</option>
                        {stateOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        placeholder="State"
                        disabled={!formData.country}
                      />
                    )}
                  </div>
                </div>


                   <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="" >City</label>
                    {citiesLoading ? (
                      <select className="form-select" name="city" value={formData.city} disabled>
                        <option value="">Loading cities...</option>
                      </select>
                    ) : cityOptions.length > 0 ? (
                      <select
                        className="form-select"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        disabled={!formData.state}
                      >
                        <option value="">Select City</option>
                        {cityOptions.map((ct) => (
                          <option key={ct} value={ct}>{ct}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        disabled={!formData.country}
                      />
                    )}
                  </div>
                </div>
             
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="" >Currency</label>
                    <select className="form-select" name="currency" value={formData.currency} onChange={handleInputChange} disabled={currenciesLoading}>
                      {currencies.map((code) => (
                        <option key={code} value={code}>
                          {currencySymbols[code] && currencySymbols[code] !== code
                            ? `${code} (${currencySymbols[code]})`
                            : code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="member-card">
            <div className="member-card-header">
              <h5>Product Lines</h5>
            </div>
            <div className="">
              <div className="table-responsive">
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>Sr. No,</th>
                      <th>Product / Material</th>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="text" className='form-control' value={line.product} onChange={(e) => updateLine(idx, 'product', e.target.value)} placeholder="Product name" />
                          </div>
                          </td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="text" className='form-control' style={{minWidth : "85px"}} value={line.sku} onChange={(e) => updateLine(idx, 'sku', e.target.value)} placeholder="SKU" />
                          </div>
                          </td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="text" className='form-control' value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="Description" />

                          </div>
                          </td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="number" className='form-control' value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} placeholder="0" />
                          </div>
                          </td>
                        <td>
                        <div className='custom-frm-bx mb-0'>
                            <select className='form-select' style={{minWidth : "85px"}} value={line.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)}>
                            <option value="MT">MT</option>
                            <option value="KG">KG</option>
                            <option value="Litre">Litre</option>
                            <option value="PCS">PCS</option>
                          </select>
                        </div>
                        </td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="number" className='form-control' value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)} placeholder="0.00" />
                          </div>
                          </td>
                        <td>
                          <div className='custom-frm-bx mb-0'>
                            <input type="text" className='form-control'  value={line.total} readOnly placeholder="0.00" style={{ background: '#f9f9f9', minWidth : "85px" }} />
                          </div>
                          </td>
                        <td>
                          {lines.length > 1 && (
                            <button className="remove-line-btn" onClick={() => removeLine(idx)}>
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             <div className='member-card-header border-0 pt-0 d-flex justify-content-end'>
               <button className="thm-btn outline py-2" onClick={addLine}>
                <FiPlus size={14} /> Add Line
              </button>
             </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4 col-md-12 col-sm-12">
          <div className="member-card" >
            <div className="member-card-header">
              <h5>Summary</h5>
            </div>
            <div className="member-card-body">
              <div className="summary-row">
                <span className="summary-label">Total Lines</span>
                <span className="summary-value">{lines.length}</span>
              </div>
              <div className="summary-row summary-row-border">
                <span className="summary-label">Total Value</span>
                <span className="summary-value">{currencySymbol}{lines.reduce((sum, l) => sum + (parseFloat(l.total) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <button className="thm-lg-btn w-100 mt-3" onClick={handleSaveOrder} disabled={loading || prefillLoading}>
                {prefillLoading ? 'Loading...' : loading ? 'Saving...' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
