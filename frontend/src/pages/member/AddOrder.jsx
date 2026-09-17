import { useState } from 'react';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import '../../styles/member.css';

export default function AddOrder() {
  const [orderType, setOrderType] = useState('sales');
  const [lines, setLines] = useState([{ product: '', sku: '', description: '', qty: '', unit: 'MT', unitPrice: '', total: '' }]);

  const addLine = () => setLines([...lines, { product: '', sku: '', description: '', qty: '', unit: 'MT', unitPrice: '', total: '' }]);
  const removeLine = (index) => setLines(lines.filter((_, i) => i !== index));
  const updateLine = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    if ((field === 'qty' || field === 'unitPrice') && updated[index].qty && updated[index].unitPrice) {
      updated[index].total = (parseFloat(updated[index].qty) * parseFloat(updated[index].unitPrice)).toFixed(2);
    }
    setLines(updated);
  };

  return (
    <div>
      <div className="member-page-header">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn"> <FiArrowLeft /> Back  </button>
          <h2 className="mb-0">Add Order</h2>
        </div>
      </div>

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
                     <input type="text" className="form-control" placeholder={`Enter ${orderType === 'sales' ? 'Customer' : 'Supplier'} Name`} />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                     <label className="">PO / Order Number</label>
                      <input type="text" className="form-control" placeholder="e.g. PO-8192" />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                    <label className="" >Order Date</label>
                    <input type="date" className="form-control" />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className='custom-frm-bx'>
                    <label className="">Required Delivery Date</label>
                     <input type="date" className="form-control" />
                  </div>
                </div>


                <div className="col-lg-12 col-md-12 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="">Delivery Address</label>
                    <input type="text" className="form-control" placeholder="Full delivery address" />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="" >City</label>
                    <input type="text" className="form-control" placeholder="City" />
                  </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                    <label className="">State</label>
                    <input type="text" className="form-control" placeholder="State" />
                  </div>
                </div>
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="">Country</label>
                    <select className="form-select">
                      <option value="">Select Country</option>
                      <option value="IN">India</option>
                      <option value="AE">UAE</option>
                      <option value="SA">Saudi Arabia</option>
                      <option value="US">United States</option>
                    </select>
                  </div>
                </div>
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="custom-frm-bx">
                  <label className="" >Currency</label>
                    <select className="form-select">
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="AED">AED</option>
                      <option value="SAR">SAR</option>
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
                <span className="summary-value">₹{lines.reduce((sum, l) => sum + (parseFloat(l.total) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <button className="thm-lg-btn w-100 mt-3">Save Order</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
