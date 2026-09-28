import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

export default function AddShipment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shipmentNumber: '',
    quantity: '',
    items: '',
    transporter: '',
    lrNumber: '',
    awbNumber: '',
    grNumber: '',
    vehicleNumber: '',
    origin: '',
    destination: '',
    dispatchDate: '',
    expectedDeliveryDate: '',
  });

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Order items, so each item's quantity can be entered separately (multi-item orders)
  const [orderItems, setOrderItems] = useState([]);
  const [itemQty, setItemQty] = useState({});
  useEffect(() => {
    let mounted = true;
    api
      .get(`/orders/${id}`)
      .then((res) => {
        if (mounted) setOrderItems(res.data.items || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [id]);

  const remainingOf = (item) => Math.max((Number(item.quantity) || 0) - (Number(item.dispatched) || 0), 0);
  const multiItem = orderItems.length > 1;
  const singleItem = orderItems.length === 1 ? orderItems[0] : null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.shipmentNumber.trim()) {
      toast.error('Shipment Number is required');
      return;
    }
    let payload = formData;
    if (multiItem) {
      const lineItems = orderItems
        .filter((item) => itemQty[item.id] !== undefined && String(itemQty[item.id]).trim() !== '')
        .map((item) => ({ orderItemId: item.id, quantity: itemQty[item.id] }));
      if (lineItems.length === 0) {
        toast.error('Enter the quantity for at least one item');
        return;
      }
      const { quantity: _unused, ...rest } = formData;
      payload = { ...rest, lineItems };
    }
    try {
      setLoading(true);
      await api.post(`/orders/${id}/shipments`, payload);
      toast.success('Shipment created successfully');
      navigate(`/app/orders/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save shipment');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'shipmentNumber', label: 'Shipment Number', type: 'text', placeholder: 'e.g. SHP-2203', required: true },
    // Multi-item orders enter quantities per item in the table below instead
    ...(multiItem
      ? []
      : [{
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          placeholder: singleItem
            ? `Enter quantity (${remainingOf(singleItem).toLocaleString('en-IN')} ${singleItem.unit || ''} left)`
            : 'Enter quantity',
        }]),
  ];

  return (
    <div>
      <div className="member-page-header">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn" onClick={() => navigate(`/app/orders/${id}`)}><FiArrowLeft /><span className='back-mobile-hide'> Back</span> </button>
          <h2 className="mb-0">Add Shipment</h2>
        </div>
      </div>

      <div className="member-card">
        <div className="member-card-body">
          <form onSubmit={handleSave}>
            <div className="row ">
              {fields.map((f) => (
                <div className="col-lg-6 col-md-6 col-sm-12" key={f.name}>
                  <div className="custom-frm-bx">
                    <label className="">{f.label}</label>
                    <input
                      type={f.type}
                      className="form-control"
                      name={f.name}
                      value={formData[f.name]}
                      onChange={handleInputChange}
                      placeholder={f.placeholder}
                    />
                  </div>
                </div>
              ))}

              {multiItem && (
                <div className="col-lg-12">
                  <div className="custom-frm-bx">
                    <label className="">Items to Ship</label>
                    <div className="table-responsive">
                      <table className="member-table">
                        <thead>
                          <tr>
                            <th>Product / Material</th>
                            <th>Ordered</th>
                            <th>Remaining</th>
                            <th>Ship Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item) => {
                            const remaining = remainingOf(item);
                            return (
                              <tr key={item.id}>
                                <td>{item.product}</td>
                                <td>{(Number(item.quantity) || 0).toLocaleString('en-IN')} {item.unit}</td>
                                <td>{remaining.toLocaleString('en-IN')} {item.unit}</td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control"
                                    min="0"
                                    max={remaining}
                                    step="any"
                                    disabled={remaining <= 0}
                                    placeholder={remaining <= 0 ? 'Fully shipped' : '0'}
                                    value={itemQty[item.id] ?? ''}
                                    onChange={(e) => setItemQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="col-lg-12">
                <div className="custom-frm-bx">
                  <label className="">Items</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    name="items"
                    value={formData.items}
                    onChange={handleInputChange}
                    placeholder="List items in this shipment"
                  />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Transporter</label>
                  <input type="text" className="form-control" name="transporter" value={formData.transporter} onChange={handleInputChange} placeholder="Transporter name" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">LR Number</label>
                  <input type="text" className="form-control" name="lrNumber" value={formData.lrNumber} onChange={handleInputChange} placeholder="LR number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">AWB Number</label>
                  <input type="text" className="form-control" name="awbNumber" value={formData.awbNumber} onChange={handleInputChange} placeholder="AWB number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="d-block mb-1" >GR Number</label>
                  <input type="text" className="form-control" name="grNumber" value={formData.grNumber} onChange={handleInputChange} placeholder="GR number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Vehicle Number</label>
                  <input type="text" className="form-control" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} placeholder="Vehicle number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Origin</label>
                  <input type="text" className="form-control" name="origin" value={formData.origin} onChange={handleInputChange} placeholder="Origin location" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="" >Destination</label>
                  <input type="text" className="form-control" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="Destination location" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="" >Dispatch Date</label>
                  <input type="date" className="form-control" name="dispatchDate" value={formData.dispatchDate} onChange={handleInputChange} />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Expected Delivery Date</label>
                  <input type="date" className="form-control" name="expectedDeliveryDate" value={formData.expectedDeliveryDate} onChange={handleInputChange} />
                </div>
              </div>
            </div>
            <div className="">
              <button className="thm-btn" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Shipment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}